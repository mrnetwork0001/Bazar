/**
 * 8004scan indexer client.
 *
 * 8004scan is the public ERC-8004 indexer that the official BNB Agent Studio
 * SDK itself uses for agent discovery (`bnbagent.constants.SCAN_API_URL`).
 * It already indexes the Identity Registry across chains, which is why Bazar
 * consumes it instead of running its own log-scanning indexer: identical data,
 * none of the infrastructure.
 *
 * The index exposes two routes, and they do not carry the same fields:
 *   GET /agents?chain_id=56&...      - the listing. What every card, the sort
 *                                      order and the A2A API read. Publishes
 *                                      the leaderboard `total_score`; `rank`
 *                                      and `network_rank` are always null.
 *   GET /agents/{chainId}/{tokenId}  - the per-agent record. Adds services,
 *                                      tags, the registration tx, the score
 *                                      breakdown and a real `rank`, but its
 *                                      top-level `total_score` is a stale
 *                                      snapshot. See lib/indexer/reputation.ts
 *                                      for which number wins and why.
 *
 * Note: the API answers on the apex domain; www 308-redirects, so we call the
 * apex directly to avoid a redirect on every request. The agent count is not
 * hardcoded anywhere - it grows daily; read it with `fetchAgentCount`.
 */

import { BSC_MAINNET, BSC_TESTNET, type SupportedChainId } from '@/lib/chain/addresses';

export const SCAN_API_BASE = 'https://8004scan.io/api/v1';

/**
 * The chains Bazar reads, and the only ones any lookup may be issued for.
 *
 * The index answers happily for Ethereum, Base and the rest, so without this
 * guard a typed slug like "1-100" resolves and renders an Ethereum identity
 * inside a BNB Chain storefront, wearing BscScan links that point at the wrong
 * chain. Every entry point that accepts a chain id from the outside - the
 * route slug, the A2A `agentId`, the middleware - narrows through here first.
 */
export const SUPPORTED_CHAIN_IDS: readonly SupportedChainId[] = [BSC_MAINNET, BSC_TESTNET];

export function isSupportedChainId(value: number): value is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(value);
}

/** One agent exactly as 8004scan returns it. Do not reshape here - map in `map.ts`. */
export interface ScanAgent {
  id: string;
  /** "<chainId>:<registry>:<tokenId>" */
  agent_id: string;
  token_id: string;
  chain_id: number;
  chain_type: string;
  contract_address: string;
  is_testnet: boolean;
  owner_address: string;
  owner_ens: string | null;
  owner_username: string | null;
  owner_certified_name: string | null;
  name: string;
  description: string;
  image_url: string | null;
  is_verified: boolean;
  star_count: number;
  /** e.g. ["A2A", "MCP", "Web"] */
  supported_protocols: string[];
  x402_supported: boolean;
  total_score: number;
  rank: number | null;
  network_rank: number | null;
  health_score: number | null;
  total_feedbacks: number;
  average_score: number;
  created_at: string;
  updated_at: string;
  /**
   * Score breakdown. Absent on listing rows, present on the per-agent record
   * (and null there for agents the scorer has not reached). Only
   * lib/indexer/reputation.ts is allowed to interpret it.
   */
  scores?: unknown;
}

/**
 * The per-agent record, unreshaped.
 *
 * Kept as an open record rather than a wide interface: it carries about sixty
 * fields of which Bazar reads a dozen, and narrowing them at the point of use
 * (app/agents/[id]/resolve.ts) is honest about which ones are actually
 * trusted. It is structurally a superset of `ScanAgent`.
 */
export type ScanAgentRecord = Record<string, unknown>;

export interface ScanPage {
  items: ScanAgent[];
  total: number;
  limit: number;
  offset: number;
}

export interface ScanQuery {
  chainId?: SupportedChainId;
  /** Free-text search across name and description. */
  search?: string;
  /** Only agents advertising x402 payment support. */
  x402Only?: boolean;
  /**
   * The orderings the index actually applies. `star_count` is deliberately
   * absent: the API accepts it and then silently ignores it, returning
   * newest-first order (verified 2026-08-28 - `sort_by=star_count` and
   * `sort_by=created_at` returned byte-identical token ids). Offering it would
   * be a sort that lies, so no caller can name it.
   */
  sortBy?: 'total_score' | 'total_feedbacks' | 'created_at';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class ScanError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ScanError';
  }
}

function buildUrl(q: ScanQuery): string {
  const p = new URLSearchParams();
  p.set('chain_id', String(q.chainId ?? BSC_MAINNET));
  p.set('limit', String(Math.min(Math.max(q.limit ?? 24, 1), 100)));
  p.set('offset', String(Math.max(q.offset ?? 0, 0)));
  // Only `search` is honoured by the API; `q`/`name` are silently ignored and
  // return the unfiltered set, so never send those as a fallback.
  if (q.search?.trim()) p.set('search', q.search.trim());
  if (q.x402Only) p.set('x402_supported', 'true');
  if (q.sortBy) {
    p.set('sort_by', q.sortBy);
    p.set('order', q.order ?? 'desc');
  }
  return `${SCAN_API_BASE}/agents?${p.toString()}`;
}

/**
 * Fetch one page of agents. Cached by the Next data cache so the marketplace
 * does not hit the indexer on every render.
 */
export async function fetchAgents(q: ScanQuery = {}, revalidateSeconds = 300): Promise<ScanPage> {
  const url = buildUrl(q);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: 'application/json' },
      next: { revalidate: revalidateSeconds },
    });
  } catch (cause) {
    throw new ScanError(`8004scan unreachable: ${(cause as Error).message}`);
  }
  if (!res.ok) throw new ScanError(`8004scan returned ${res.status} for ${url}`, res.status);

  const body = (await res.json()) as Partial<ScanPage>;
  if (!Array.isArray(body.items)) throw new ScanError('8004scan response missing `items`');

  return {
    items: body.items,
    total: body.total ?? body.items.length,
    limit: body.limit ?? body.items.length,
    offset: body.offset ?? 0,
  };
}

/** Total agents indexed on a chain - the headline marketplace stat. */
export async function fetchAgentCount(
  chainId: SupportedChainId = BSC_MAINNET,
  revalidateSeconds = 900,
): Promise<number> {
  const page = await fetchAgents({ chainId, limit: 1 }, revalidateSeconds);
  return page.total;
}

/** Parse the composite "<chainId>:<registry>:<tokenId>" id. */
export function parseAgentId(agentId: string): { chainId: number; registry: string; tokenId: string } | null {
  const parts = agentId.split(':');
  if (parts.length !== 3) return null;
  const [chainId, registry, tokenId] = parts;
  if (!/^\d+$/.test(chainId) || !/^0x[0-9a-fA-F]{40}$/.test(registry) || !/^\d+$/.test(tokenId)) return null;
  return { chainId: Number(chainId), registry, tokenId };
}

/**
 * The per-agent record for one token id, or null when the index has no such
 * identity on that chain.
 *
 * `GET /agents/{chainId}/{tokenId}` does exist and answers for any indexed
 * token id, however deep in the listing it sits (verified 2026-08-28 against
 * 56-149864, ~150,000 rows from the head). An earlier note in this file
 * claimed no detail route existed; that was true only of
 * `GET /agents/{compositeId}`, which really does 404.
 *
 * A 404 here means "this chain does not index that token id" and is returned
 * as null. Any other failure - transport, 5xx, unparseable body - is also
 * null, because a caller that cannot tell the two apart must not present
 * either as proof the identity does not exist.
 */
export async function fetchAgentRecord(
  chainId: SupportedChainId,
  tokenId: string,
  revalidateSeconds = 300,
): Promise<ScanAgentRecord | null> {
  if (!/^\d+$/.test(tokenId)) return null;

  let res: Response;
  try {
    res = await fetch(`${SCAN_API_BASE}/agents/${chainId}/${encodeURIComponent(tokenId)}`, {
      headers: { accept: 'application/json' },
      next: { revalidate: revalidateSeconds },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  return body as ScanAgentRecord;
}

/**
 * The listing row for one token id - the exact row the marketplace card, the
 * ranking and `GET /api/v1/a2a/agents` render.
 *
 * The listing endpoint has no by-token lookup, but its free-text `search`
 * matches the token id and a token id is distinctive enough to pin one row
 * (verified 2026-08-28: `search=149864` returned total=1). The match is still
 * checked exactly, because `search` also hits name and description.
 */
export async function fetchListingRow(
  chainId: SupportedChainId,
  tokenId: string,
  revalidateSeconds = 300,
): Promise<ScanAgent | null> {
  if (!/^\d+$/.test(tokenId)) return null;
  const page = await fetchAgents({ chainId, search: tokenId, limit: 100 }, revalidateSeconds);
  return page.items.find((a) => a.token_id === tokenId && a.chain_id === chainId) ?? null;
}
