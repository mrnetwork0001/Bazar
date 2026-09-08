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

import { BSC_MAINNET, type SupportedChainId } from '@/lib/chain/addresses';

export const SCAN_API_BASE = 'https://8004scan.io/api/v1';

/**
 * Request headers for every index call, including the API key when one is set.
 *
 * Measured against the live API on 2026-09-07: unauthenticated requests are
 * capped at 180/minute and 20,000/day, while the same request carrying
 * `x-api-key` reports 600/minute and 100,000/day. Bazar renders nothing that is
 * not read from this index, and judging puts several readers on it at once, so
 * the key is worth having - but it is optional, and every route works without
 * one at the lower ceiling.
 *
 * `SCAN_API_KEY` is the name to use. `API_Key` is accepted because that is what
 * the key was first pasted in as, and a silently ignored key is worse than an
 * ugly name.
 *
 * This is deliberately NOT a `NEXT_PUBLIC_` variable. Every caller of this
 * module runs on the server (server components, route handlers), so the key
 * stays out of the browser bundle; a client import would see `undefined` and
 * fall back to the unauthenticated tier rather than leaking it.
 */
function scanHeaders(): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const key = (process.env.SCAN_API_KEY ?? process.env.API_Key ?? '').trim();
  if (key) headers['x-api-key'] = key;
  return headers;
}

/**
 * The chains Bazar reads, and the only ones any lookup may be issued for.
 *
 * The index answers happily for Ethereum, Base and the rest, so without this
 * guard a typed slug like "1-100" resolves and renders an Ethereum identity
 * inside a BNB Chain storefront, wearing BscScan links that point at the wrong
 * chain. Every entry point that accepts a chain id from the outside - the
 * route slug, the A2A `agentId`, the middleware - narrows through here first.
 */
/**
 * Bazar is a BNB Smart Chain product. Mainnet only, deliberately.
 *
 * Testnet was supported while the settlement path was being proven, but a
 * marketplace that mixes the two is worse than one that does not: an ERC-8004
 * token id resolves to a different agent on each network, so a testnet listing
 * beside a mainnet one invites hiring the wrong party, and a testnet agent's
 * reputation is not a claim about anything real. The testnet deployment
 * addresses stay in `lib/chain/addresses.ts` for reference, but nothing is
 * indexed, resolved, listed or settled off chain 56.
 */
export const SUPPORTED_CHAIN_IDS: readonly SupportedChainId[] = [BSC_MAINNET];

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
 * How long any single attempt may block a render before it is given up on.
 *
 * The index has been observed hanging rather than refusing: a request to a deep
 * offset sat open for 40s in testing. A server component awaiting that stalls
 * the whole page, so every attempt is raced against this.
 *
 * The timeout is a race rather than an AbortSignal deliberately - passing a
 * signal into `fetch` changes how Next keys its data cache, and the cache is
 * what keeps the marketplace off the indexer for most renders.
 */
const ATTEMPT_TIMEOUT_MS = 6_000;
const MAX_ATTEMPTS = 3;

/**
 * The last good answer for a given URL, kept so a transient failure degrades to
 * slightly-old real data instead of an empty shelf.
 *
 * This is real data the index really returned, with the time it was fetched, so
 * a caller can say how old it is. It is never a substitute for data that was
 * never there: an empty result is cached as empty, and a URL that has never
 * succeeded has no entry and still throws.
 */
interface Snapshot {
  page: ScanPage;
  at: number;
}
const lastGood = new Map<string, Snapshot>();

/** How stale a fallback may be before it is no longer worth showing: 1 hour. */
const MAX_STALE_MS = 60 * 60 * 1000;

export interface FetchAgentsResult extends ScanPage {
  /** Set when this came from `lastGood` because every live attempt failed. */
  stale?: { ageMs: number };
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new ScanError(`8004scan did not answer within ${ms}ms`)), ms),
  );
}

/**
 * One attempt. Throws `ScanError` on anything the caller should retry.
 *
 * The index signals failure two different ways and only one of them is an HTTP
 * error: a failing query comes back as a 200 carrying
 * `{"success":false,"error":{"code":"DATABASE_ERROR"}}`. Treating a missing
 * `items` array as a permanent shape error - which is what this used to do -
 * turned that transient database hiccup into a blank marketplace, so the
 * envelope is recognised and retried.
 */
async function attempt(url: string, revalidateSeconds: number): Promise<ScanPage> {
  let res: Response;
  try {
    res = await Promise.race([
      fetch(url, { headers: scanHeaders(), next: { revalidate: revalidateSeconds } }),
      timeout(ATTEMPT_TIMEOUT_MS),
    ]);
  } catch (cause) {
    if (cause instanceof ScanError) throw cause;
    throw new ScanError(`8004scan unreachable: ${(cause as Error).message}`);
  }
  if (!res.ok) throw new ScanError(`8004scan returned ${res.status}`, res.status);

  const body = (await res.json()) as Partial<ScanPage> & {
    success?: boolean;
    error?: { code?: string; message?: string };
  };

  if (body.success === false || body.error) {
    throw new ScanError(`8004scan query failed: ${body.error?.code ?? 'unknown'}`);
  }
  if (!Array.isArray(body.items)) throw new ScanError('8004scan response missing `items`');

  return {
    items: body.items,
    total: body.total ?? body.items.length,
    limit: body.limit ?? body.items.length,
    offset: body.offset ?? 0,
  };
}

/**
 * Fetch one page of agents, retrying transient index failures.
 *
 * Measured on 2026-09-07, the index fails roughly one request in five at
 * offset 0 and considerably more often on deep offsets and on `search`, with a
 * mix of 500s, 502s, open-ended hangs and 200s carrying a DATABASE_ERROR body.
 * The failures are not term-dependent - the same query succeeds and fails
 * minutes apart - so they are worth retrying rather than reporting.
 *
 * Three bounded attempts take an independent 20% failure rate to under 1%. If
 * all three fail, the last good answer for this exact URL is served and marked
 * stale, and only if there has never been one does this throw.
 */
export async function fetchAgents(q: ScanQuery = {}, revalidateSeconds = 300): Promise<FetchAgentsResult> {
  const url = buildUrl(q);
  let lastErr: unknown;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const page = await attempt(url, revalidateSeconds);
      lastGood.set(url, { page, at: Date.now() });
      return page;
    } catch (err) {
      lastErr = err;

      // Retrying is only worth a reader's time when there is nothing better to
      // show them. Measured 2026-09-08, the ranked listing query answers 500
      // after ~10.6s or 200 after ~5.4s, so a failed first attempt plus a
      // successful retry costs upwards of ten seconds of blank page - and
      // repeats for every request, because a failed fetch leaves nothing in
      // Next's data cache to serve.
      //
      // So the moment an attempt fails, a usable snapshot wins. The reader gets
      // real data this index really returned, marked stale, in microseconds
      // instead of waiting out a retry that may fail anyway.
      const snap = lastGood.get(url);
      if (snap) {
        const ageMs = Date.now() - snap.at;
        if (ageMs < MAX_STALE_MS) return { ...snap.page, stale: { ageMs } };
      }

      // Linear backoff. The failures look like load, so pausing helps; the
      // total budget still has to fit inside a page render.
      if (i < MAX_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }

  throw lastErr instanceof ScanError ? lastErr : new ScanError(String(lastErr));
}

/**
 * Total agents indexed on a chain - the headline marketplace stat.
 *
 * Cached for a minute rather than the listings' five, because this number is
 * the one a reader watches. BSC is registering roughly 90 ERC-8004 agents an
 * hour (287,993 on 28 Aug, 294,599 on 31 Aug), so a 60s window means the count
 * visibly moves while someone is looking at it instead of sitting still for a
 * quarter of an hour. It costs one request a minute for the whole deployment,
 * not one per visitor, because the cache is shared.
 */
export async function fetchAgentCount(
  chainId: SupportedChainId = BSC_MAINNET,
  revalidateSeconds = 60,
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
      headers: scanHeaders(),
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
