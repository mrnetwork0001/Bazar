/**
 * 8004scan indexer client.
 *
 * 8004scan is the public ERC-8004 indexer that the official BNB Agent Studio
 * SDK itself uses for agent discovery (`bnbagent.constants.SCAN_API_URL`).
 * It already indexes the Identity Registry across chains, which is why Bazar
 * consumes it instead of running its own log-scanning indexer: identical data,
 * none of the infrastructure.
 *
 * Verified live 2026-08-28: 287,993 agents on BSC mainnet (chain_id=56),
 * 66,676 of which advertise x402 support.
 *
 * Note: the API answers on the apex domain; www 308-redirects, so we call the
 * apex directly to avoid a redirect on every request.
 */

import { BSC_MAINNET, type SupportedChainId } from '@/lib/chain/addresses';

export const SCAN_API_BASE = 'https://8004scan.io/api/v1';

/** One agent exactly as 8004scan returns it. Do not reshape here — map in `map.ts`. */
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
}

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
  sortBy?: 'total_score' | 'star_count' | 'total_feedbacks' | 'created_at';
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

/** Total agents indexed on a chain — the headline marketplace stat. */
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
 * There is no working per-agent detail route on the public API (a GET on
 * /agents/<agent_id> 404s), so a single agent is resolved by searching its
 * name and matching the composite id exactly.
 */
export async function fetchAgentById(agentId: string, revalidateSeconds = 300): Promise<ScanAgent | null> {
  const parsed = parseAgentId(agentId);
  if (!parsed) return null;
  const page = await fetchAgents(
    { chainId: parsed.chainId as SupportedChainId, limit: 100 },
    revalidateSeconds,
  );
  return page.items.find((a) => a.agent_id === agentId) ?? null;
}
