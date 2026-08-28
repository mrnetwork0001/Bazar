/**
 * The single data access point for agents.
 *
 * Everything in the app — pages, the A2A API, the landing stats — reads
 * through here, so the human storefront and the machine endpoint can never
 * disagree about what is listed.
 *
 * Category filtering deserves a note: 8004scan has no category field, so
 * Bazar classifies locally (lib/indexer/classify.ts). That means a category
 * filter cannot be pushed down to the API — we over-fetch and filter here.
 * `CATEGORY_FETCH_MULTIPLIER` controls how much we over-fetch to still fill a
 * page after classification drops non-matching agents.
 */

import { BSC_MAINNET, DEFAULT_CHAIN_ID, type SupportedChainId } from '@/lib/chain/addresses';
import { mapAgents } from '@/lib/indexer/map';
import { fetchAgents, fetchAgentCount, ScanError, type ScanQuery } from '@/lib/indexer/scan-client';
import type { CategoryId, IndexedAgent } from '@/lib/types';

export type SortKey = 'reputation' | 'feedback' | 'stars' | 'newest';

const SORT_MAP: Record<SortKey, { sortBy: NonNullable<ScanQuery['sortBy']>; order: 'asc' | 'desc' }> = {
  reputation: { sortBy: 'total_score', order: 'desc' },
  feedback: { sortBy: 'total_feedbacks', order: 'desc' },
  stars: { sortBy: 'star_count', order: 'desc' },
  newest: { sortBy: 'created_at', order: 'desc' },
};

const CATEGORY_FETCH_MULTIPLIER = 4;
const MAX_SCAN_LIMIT = 100;

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
    const message = err instanceof ScanError ? err.message : (err as Error).message;
    return { agents: [], total: 0, limit, offset, degraded: true, error: message };
  }
}

/** Resolve one agent by its URL slug ("<chainId>-<tokenId>"). */
export async function getAgentBySlug(slug: string): Promise<IndexedAgent | null> {
  const match = /^(\d+)-(\d+)$/.exec(slug);
  if (!match) return null;
  const [, chainIdRaw, tokenId] = match;
  const chainId = Number(chainIdRaw) as SupportedChainId;

  // No usable per-agent detail route exists on the public index, so the agent
  // is located by paging the chain's listing and matching on token id.
  for (let offset = 0; offset < 300; offset += MAX_SCAN_LIMIT) {
    try {
      const page = await fetchAgents({ chainId, limit: MAX_SCAN_LIMIT, offset });
      const hit = page.items.find((a) => a.token_id === tokenId);
      if (hit) return mapAgents([hit])[0];
      if (page.items.length < MAX_SCAN_LIMIT) break;
    } catch {
      return null;
    }
  }
  return null;
}

/** Headline stats for the landing page. */
export async function getMarketStats(chainId: SupportedChainId = BSC_MAINNET) {
  try {
    const [total, x402] = await Promise.all([
      fetchAgentCount(chainId),
      fetchAgents({ chainId, limit: 1, x402Only: true }, 900).then((p) => p.total),
    ]);
    return { indexedAgents: total, x402Agents: x402, chainId, degraded: false };
  } catch {
    return { indexedAgents: 0, x402Agents: 0, chainId, degraded: true };
  }
}
