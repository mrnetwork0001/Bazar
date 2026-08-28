/**
 * Route-local agent resolution for /agents/[id].
 *
 * The detail page reads BOTH index routes, because each one carries something
 * the other does not:
 *   - `GET /agents/{chainId}/{tokenId}` - the services, tags, registration tx,
 *     operating wallet, component scores and the real `rank`.
 *   - `GET /agents?...&search=<tokenId>` - the listing row the card the reader
 *     just clicked was rendered from.
 *
 * They famously disagree on the headline number: on 2026-08-28 the listing
 * published OpenOdds.Ai at total_score 49.06 while the per-agent record's
 * top-level `total_score` said 30.52. That disagreement is settled once, in
 * lib/indexer/reputation.ts, and it is settled for everyone - the card, the
 * sort order, this page and `GET /api/v1/a2a/agents` all read the same
 * canonical value through `mapAgent`. Nothing in this file is allowed to pick
 * a score.
 *
 * What this file does still decide is the merge: when both routes answered,
 * `mergeReputation` keeps the listing's numbers and lets the per-agent record
 * contribute only `rank` / `networkRank`, which the listing never publishes at
 * all. So the page can show a rank the card could not, without ever showing a
 * score the card did not.
 */

import { resolveAgentSlug } from '@/lib/agents/repository';
import { isMappableRecord, mapAgent } from '@/lib/indexer/map';
import { mergeReputation } from '@/lib/indexer/reputation';
import {
  fetchAgentRecord,
  fetchListingRow,
  isSupportedChainId,
  type ScanAgent,
} from '@/lib/indexer/scan-client';
import type { SupportedChainId } from '@/lib/chain/addresses';
import type { Address, IndexedAgent } from '@/lib/types';
import type { AgentDetail, AgentDetailExtras, AgentEndpoint, ScoreDimension } from '@/components/agents/agent-detail';
import { EMPTY_EXTRAS } from '@/components/agents/agent-detail';
import { isAddress } from '@/lib/utils';

/* ------------------------------- narrowing ------------------------------ */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim());
}

/**
 * An empty array is "not published", not "zero".
 *
 * 56-49637 publishes `services.a2a.skills: []` while the same record's own
 * scoring breakdown counts twelve skills, so rendering "0 skills" would be an
 * affirmative claim the index does not make. Omit the fact instead.
 */
function countOf(value: unknown): number | null {
  return Array.isArray(value) && value.length > 0 ? value.length : null;
}

/* -------------------------------- extras -------------------------------- */

/** Stable display order; anything unrecognised keeps index order after these. */
const ENDPOINT_ORDER = ['a2a', 'mcp', 'web', 'email'];

const SCORE_LABELS: Record<string, string> = {
  quality: 'Quality',
  popularity: 'Popularity',
  activity: 'Activity',
  wallet: 'Wallet',
  freshness: 'Freshness',
  metadata_completeness: 'Metadata completeness',
};

function extractEndpoints(raw: Record<string, unknown>): AgentEndpoint[] {
  const services = asRecord(raw.services);
  if (!services) return [];

  const out: AgentEndpoint[] = [];
  for (const [protocol, value] of Object.entries(services)) {
    const service = asRecord(value);
    const url = asString(service?.endpoint);
    if (!url) continue;
    out.push({
      protocol,
      url,
      version: asString(service?.version),
      toolCount: countOf(service?.tools),
      skillCount: countOf(service?.skills),
    });
  }

  return out.sort((a, b) => {
    const ai = ENDPOINT_ORDER.indexOf(a.protocol.toLowerCase());
    const bi = ENDPOINT_ORDER.indexOf(b.protocol.toLowerCase());
    return (ai === -1 ? ENDPOINT_ORDER.length : ai) - (bi === -1 ? ENDPOINT_ORDER.length : bi);
  });
}

function extractScores(raw: Record<string, unknown>): { scores: ScoreDimension[]; scoredAt: string | null } {
  const scores = asRecord(raw.scores);
  if (!scores) return { scores: [], scoredAt: null };

  const out: ScoreDimension[] = [];
  for (const [key, label] of Object.entries(SCORE_LABELS)) {
    const value = asNumber(scores[key]);
    if (value === null) continue;
    out.push({ key, label, value });
  }
  return { scores: out, scoredAt: asString(scores.last_scored_at) ?? asString(raw.last_scored_at) };
}

function extractExtras(raw: Record<string, unknown>): AgentDetailExtras {
  const { scores, scoredAt } = extractScores(raw);
  const wallet = asString(raw.agent_wallet);

  return {
    registrationTx: asString(raw.created_tx_hash),
    agentWallet: wallet && isAddress(wallet) ? (wallet as Address) : null,
    endpoints: extractEndpoints(raw),
    tags: asStringList(raw.tags).slice(0, 12),
    trustModels: asStringList(raw.supported_trust_models),
    scores,
    scoredAt,
  };
}

/* -------------------------------- resolve ------------------------------- */

/**
 * The per-agent record, mapped. `mapAgent` reads the canonical score out of
 * `scores.breakdown.final_score`, so this agrees with the listing to the
 * decimal even when the listing lookup below fails.
 */
async function fetchDetail(chainId: SupportedChainId, tokenId: string): Promise<AgentDetail | null> {
  const raw = await fetchAgentRecord(chainId, tokenId);
  if (!raw || !isMappableRecord(raw)) return null;
  return { agent: mapAgent(raw as unknown as ScanAgent), extras: extractExtras(raw) };
}

/** The listing row for one token id, mapped - the row the card was built from. */
async function fetchListing(chainId: SupportedChainId, tokenId: string): Promise<IndexedAgent | null> {
  try {
    const row = await fetchListingRow(chainId, tokenId);
    return row ? mapAgent(row) : null;
  } catch {
    return null;
  }
}

/**
 * Resolve one agent for the detail route.
 *
 * Returns null only when the chain is not one Bazar reads, or when neither
 * index route could produce the identity - which the page treats as "not
 * resolvable", a weaker claim than "does not exist".
 */
export async function resolveAgentDetail(
  chainId: number,
  tokenId: string,
  slug: string,
): Promise<AgentDetail | null> {
  // Bazar is a BNB Chain storefront. Rendering an identity from another chain
  // here would attach BscScan links and a "BSC rank" to a record that has
  // neither, so it is not resolvable rather than wrongly resolved. The index
  // itself answers for chain 1, so this guard is load-bearing, not defensive.
  if (!isSupportedChainId(chainId)) return null;

  // Independent reads, so they go together rather than in sequence.
  const [detail, listing] = await Promise.all([
    fetchDetail(chainId, tokenId),
    fetchListing(chainId, tokenId),
  ]);

  if (detail) {
    return listing
      ? {
          agent: {
            ...detail.agent,
            // The listing wins on every number it publishes; the per-agent
            // record only fills in the rank the listing omits entirely.
            reputation: mergeReputation(listing.reputation, detail.agent.reputation),
          },
          extras: detail.extras,
        }
      : detail;
  }

  if (listing) return { agent: listing, extras: EMPTY_EXTRAS };

  const resolution = await resolveAgentSlug(slug);
  return resolution.status === 'found' ? { agent: resolution.agent, extras: EMPTY_EXTRAS } : null;
}
