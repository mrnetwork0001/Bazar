/**
 * The single data access point for agents.
 *
 * Everything in the app - pages, the A2A API, the landing stats - reads
 * through here, so the human storefront and the machine endpoint can never
 * disagree about what is listed.
 *
 * Category filtering deserves a note: 8004scan has no category field, so
 * Bazar classifies locally (lib/indexer/classify.ts). That means a category
 * filter cannot be pushed down to the API - we over-fetch and filter here.
 * `CATEGORY_FETCH_MULTIPLIER` controls how much we over-fetch to still fill a
 * page after classification drops non-matching agents.
 */

import { BSC_MAINNET, DEFAULT_CHAIN_ID, type SupportedChainId } from '@/lib/chain/addresses';
import { isMappableRecord, mapAgent, mapAgents } from '@/lib/indexer/map';
import {
  fetchAgentRecord,
  fetchAgents,
  fetchAgentCount,
  fetchListingRow,
  isSupportedChainId,
  ScanError,
  type ScanAgent,
  type ScanQuery,
} from '@/lib/indexer/scan-client';
import type { CategoryId, IndexedAgent } from '@/lib/types';

/**
 * The orderings Bazar offers.
 *
 * There is no `stars`. The index accepts `sort_by=star_count` and then ignores
 * it, returning the default newest-first order (verified 2026-08-28:
 * `sort_by=star_count` and `sort_by=created_at` returned byte-identical token
 * ids). A control that claims to sort and does not is a lie the user cannot
 * see, so the key does not exist and nothing can offer it.
 *
 * These three are also all the registry data supports: identity and reputation
 * only, so there is no price, ROI, uptime or SLA to order by.
 */
export type SortKey = 'reputation' | 'feedback' | 'newest';

export const SORT_KEYS: readonly SortKey[] = ['reputation', 'feedback', 'newest'];

export function isSortKey(value: string): value is SortKey {
  return (SORT_KEYS as readonly string[]).includes(value);
}

const SORT_MAP: Record<SortKey, { sortBy: NonNullable<ScanQuery['sortBy']>; order: 'asc' | 'desc' }> = {
  reputation: { sortBy: 'total_score', order: 'desc' },
  feedback: { sortBy: 'total_feedbacks', order: 'desc' },
  newest: { sortBy: 'created_at', order: 'desc' },
};

const CATEGORY_FETCH_MULTIPLIER = 4;
const MAX_SCAN_LIMIT = 100;

function errorMessage(err: unknown): string {
  if (err instanceof ScanError) return err.message;
  return err instanceof Error ? err.message : String(err);
}

export interface AgentQuery {
  category?: CategoryId | 'all';
  search?: string;
  x402Only?: boolean;
  verifiedOnly?: boolean;
  sort?: SortKey;
  limit?: number;
  offset?: number;
  chainId?: SupportedChainId;
}

export interface AgentPage {
  agents: IndexedAgent[];
  /** Index-wide total for the query, before local category filtering. */
  total: number;
  limit: number;
  offset: number;
  /** True when the indexer was unreachable and this page is empty. */
  degraded: boolean;
  error?: string;
}

export async function queryAgents(query: AgentQuery = {}): Promise<AgentPage> {
  const {
    category = 'all',
    search,
    x402Only,
    verifiedOnly,
    sort = 'reputation',
    limit = 24,
    offset = 0,
    chainId = DEFAULT_CHAIN_ID,
  } = query;

  const needsLocalFilter = category !== 'all' || verifiedOnly;
  const scanLimit = Math.min(
    needsLocalFilter ? limit * CATEGORY_FETCH_MULTIPLIER : limit,
    MAX_SCAN_LIMIT,
  );

  try {
    const page = await fetchAgents({
      chainId,
      search,
      x402Only,
      limit: scanLimit,
      offset,
      ...SORT_MAP[sort],
    });

    let agents = mapAgents(page.items);
    if (category !== 'all') agents = agents.filter((a) => a.category === category);
    if (verifiedOnly) agents = agents.filter((a) => a.verified);

    return {
      agents: agents.slice(0, limit),
      total: page.total,
      limit,
      offset,
      degraded: false,
    };
  } catch (err) {
    // The marketplace must still render if the indexer is down; an empty
    // shelf with an explanation beats a 500.
    //
    // `degraded: true` with `agents: []` is NOT the same claim as a successful
    // empty page (`degraded: false`, `total: 0`), and consumers must keep
    // telling them apart: one means "nothing matched", the other means "we
    // could not look".
    return { agents: [], total: 0, limit, offset, degraded: true, error: errorMessage(err) };
  }
}

/**
 * Why a slug did not resolve. A caller that renders a 404 must be able to tell
 * "no such identity" from "we could not look", and both from "that identity is
 * not this storefront's to show".
 */
export type AgentResolution =
  | { status: 'found'; agent: IndexedAgent }
  /** The slug is not "<chainId>-<tokenId>". */
  | { status: 'malformed' }
  /** Well-formed, but names a chain Bazar does not read. Never a 200. */
  | { status: 'unsupported-chain'; chainId: number }
  /** The index answered and has no such token id on that chain. */
  | { status: 'not-found' }
  /** The index did not answer. Not evidence about the agent either way. */
  | { status: 'degraded'; error?: string };

const SLUG = /^(\d+)-(\d+)$/;

/**
 * Resolve one agent by its URL slug ("<chainId>-<tokenId>"), reporting which
 * of the five outcomes happened.
 *
 * Any agent that can appear in a listing resolves here. The old implementation
 * walked the chain's default listing 300 rows deep, which is newest-first, so
 * the only agents it could resolve were the ~300 most recently minted - and
 * every reputation-ranked card linked to a page that could not open. Both
 * lookups used now are by token id and are depth-independent:
 *
 *   1. `GET /agents/{chainId}/{tokenId}` - answers for any indexed token id
 *      (verified 2026-08-28 against 56-149864, ~150,000 rows deep).
 *   2. the listing row, found via the index's free-text `search`, which
 *      matches the token id (verified: `search=149864` returns total=1).
 *
 * The per-agent record is tried first because it also answers for identities
 * whose text `search` has not indexed yet. Reputation is read identically from
 * either shape - see lib/indexer/reputation.ts - so the page renders the same
 * score whichever one answered.
 */
export async function resolveAgentSlug(slug: string): Promise<AgentResolution> {
  const match = SLUG.exec(slug);
  if (!match) return { status: 'malformed' };

  const [, chainIdRaw, tokenId] = match;
  const chainId = Number(chainIdRaw);
  // Bazar is a BNB Chain storefront. Resolving another chain's identity here
  // would dress it in BscScan links it has no rows behind, so it is refused
  // rather than rendered - see SUPPORTED_CHAIN_IDS in lib/indexer/scan-client.
  if (!isSupportedChainId(chainId)) return { status: 'unsupported-chain', chainId };

  const record = await fetchAgentRecord(chainId, tokenId);
  if (record && isMappableRecord(record)) {
    return { status: 'found', agent: mapAgent(record as unknown as ScanAgent) };
  }

  try {
    const row = await fetchListingRow(chainId, tokenId);
    if (row) return { status: 'found', agent: mapAgent(row) };
  } catch (err) {
    return { status: 'degraded', error: errorMessage(err) };
  }

  // `fetchAgentRecord` collapses a 404 and a transport failure into null, so
  // the listing lookup above is what distinguishes them: it answered, and it
  // has no such row.
  return { status: 'not-found' };
}

/**
 * Resolve one agent by slug, or null.
 *
 * Thin wrapper over `resolveAgentSlug` for callers that only need the agent.
 * Anything that renders a 404 or a 503 should call `resolveAgentSlug` instead,
 * so it can tell "not indexed" from "index unreachable".
 */
export async function getAgentBySlug(slug: string): Promise<IndexedAgent | null> {
  const resolution = await resolveAgentSlug(slug);
  return resolution.status === 'found' ? resolution.agent : null;
}

/** Headline stats for the landing page. */
export async function getMarketStats(chainId: SupportedChainId = BSC_MAINNET) {
  try {
    const [total, x402] = await Promise.all([
      fetchAgentCount(chainId),
      // Same 60s window as the total beside it: two figures in one strip that
      // refresh on different clocks would drift visibly out of step.
      fetchAgents({ chainId, limit: 1, x402Only: true }, 60).then((p) => p.total),
    ]);
    return { indexedAgents: total, x402Agents: x402, chainId, degraded: false };
  } catch {
    return { indexedAgents: 0, x402Agents: 0, chainId, degraded: true };
  }
}
