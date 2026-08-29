'use client';

import { useEffect, useMemo, useState } from 'react';

import type { SupportedChainId } from '@/lib/chain/addresses';
import type { Address } from '@/lib/types';

/**
 * Resolving a job's `provider` address back to the ERC-8004 agent that owns it.
 *
 * A job stores an address, not an identity. Bazar's hire flow passes the agent's
 * Identity NFT owner as `provider` (see `lib/a2a/hire-service.ts`), so the
 * reverse lookup is "which indexed agent is owned by this address" - and it can
 * legitimately answer none, one, or several.
 *
 * The lookup goes through Bazar's own `/api/v1/a2a/agents`, not straight to the
 * public index, for a measured reason: 8004scan reflects the request Origin
 * into `access-control-allow-origin` only for origins it knows, and returned NO
 * CORS header for an arbitrary origin when tested on 2026-08-28. A browser fetch
 * would therefore work in local development and fail in production. Going
 * through Bazar's own route also reuses the Next data cache and the same
 * `queryAgents` the storefront reads, so a resolved name here and the agent page
 * it links to cannot disagree.
 *
 * The index's free-text `search` matches an owner address (verified: searching
 * `0xBBfD4c1e…d1Cc`, the provider on real mainnet job 56664, returns exactly the
 * agent "OnyxOracle", token 302651). It also matches names and descriptions, so
 * every row is re-checked against `owner` before it is used - a search hit is
 * not evidence of ownership.
 *
 * Every outcome is reported distinctly. "The index is down" is never rendered
 * as "this provider is not an agent".
 */

/** The subset of the agent record this surface renders. */
export interface ResolvedProviderAgent {
  slug: string;
  name: string;
  tokenId: string;
  owner: Address;
  verified: boolean;
}

export type ProviderResolution =
  /** The provider is the zero address: the kernel accepts that, `setProvider` fills it in later. */
  | { status: 'unset' }
  | { status: 'resolving' }
  | { status: 'resolved'; agent: ResolvedProviderAgent }
  /** Several indexed agents share this owner address, so the job does not name one. */
  | { status: 'ambiguous'; count: number; agents: ResolvedProviderAgent[] }
  /** The index answered, and no indexed agent on this chain is owned by that address. */
  | { status: 'unregistered' }
  /** The index did not answer. Not evidence about the address either way. */
  | { status: 'unavailable' };

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Ceiling on lookups per render pass, so a long job list cannot fan out. */
const MAX_LOOKUPS = 16;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Pull the fields we render off one row of the API response, or null.
 *
 * Deliberately strict: a row missing `owner` cannot be checked for ownership,
 * and a row we cannot check is discarded rather than shown next to a job as
 * though the chain vouched for it.
 */
function toAgent(row: unknown): ResolvedProviderAgent | null {
  if (!isRecord(row)) return null;
  const { slug, name, tokenId, owner, verified } = row;
  if (typeof slug !== 'string' || typeof name !== 'string' || typeof tokenId !== 'string') return null;
  if (typeof owner !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(owner)) return null;
  return { slug, name, tokenId, owner: owner as Address, verified: verified === true };
}

async function lookup(
  chainId: SupportedChainId,
  provider: Address,
  signal: AbortSignal,
): Promise<ProviderResolution> {
  const params = new URLSearchParams({
    search: provider,
    chainId: String(chainId),
    limit: '100',
  });

  let response: Response;
  try {
    response = await fetch(`/api/v1/a2a/agents?${params.toString()}`, {
      headers: { accept: 'application/json' },
      signal,
    });
  } catch {
    return { status: 'unavailable' };
  }
  if (!response.ok) return { status: 'unavailable' };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: 'unavailable' };
  }
  if (!isRecord(body) || !Array.isArray(body.data)) return { status: 'unavailable' };

  const wanted = provider.toLowerCase();
  const matches = body.data
    .map(toAgent)
    .filter((a): a is ResolvedProviderAgent => a !== null && a.owner.toLowerCase() === wanted);

  if (matches.length === 0) return { status: 'unregistered' };
  if (matches.length === 1) return { status: 'resolved', agent: matches[0]! };
  return { status: 'ambiguous', count: matches.length, agents: matches };
}

/**
 * Resolve every distinct provider address in one pass, keyed by lowercase
 * address. Addresses beyond `MAX_LOOKUPS` are simply absent from the map, and a
 * caller that finds nothing for an address must render the raw address rather
 * than assume anything about it.
 */
export function useProviderAgents(
  chainId: SupportedChainId | null,
  providers: readonly Address[],
): Map<string, ProviderResolution> {
  const [resolutions, setResolutions] = useState<Map<string, ProviderResolution>>(new Map());

  // A stable key so the effect does not re-run on every render of the same set.
  const distinct = useMemo(() => {
    const seen = new Set<string>();
    const out: Address[] = [];
    for (const p of providers) {
      const key = p.toLowerCase();
      if (key === ZERO_ADDRESS || seen.has(key)) continue;
      seen.add(key);
      out.push(p);
      if (out.length >= MAX_LOOKUPS) break;
    }
    return out;
  }, [providers]);

  const key = distinct.map((p) => p.toLowerCase()).join(',');

  useEffect(() => {
    if (!chainId || distinct.length === 0) {
      setResolutions(new Map());
      return;
    }

    const controller = new AbortController();
    setResolutions(new Map(distinct.map((p) => [p.toLowerCase(), { status: 'resolving' } as ProviderResolution])));

    let cancelled = false;
    void Promise.all(
      distinct.map(async (provider) => {
        const resolution = await lookup(chainId, provider, controller.signal);
        if (cancelled) return;
        setResolutions((prev) => {
          const next = new Map(prev);
          next.set(provider.toLowerCase(), resolution);
          return next;
        });
      }),
    );

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `key` is the identity of `distinct`; listing the array itself would
    // re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, key]);

  return resolutions;
}

/** The zero address, exported so job rows can name the "no provider yet" case. */
export { ZERO_ADDRESS };
