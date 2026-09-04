'use client';

/**
 * The connected wallet's .bnb name, when it has one.
 *
 * Cached through react-query so the lookup happens once per address rather
 * than on every render of every surface that wants to show a name. A missing
 * name is cached too - most addresses have no reverse record, and re-asking
 * the chain about that on each mount would be two RPC calls for a null.
 */

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { resolveBnbName } from '@/lib/chain/bnb-name';
import { BSC_MAINNET } from '@/lib/chain/addresses';
import type { Address } from '@/lib/types';

export function useBnbName(address: Address | undefined) {
  const client = usePublicClient({ chainId: BSC_MAINNET });

  const { data } = useQuery({
    queryKey: ['bnb-name', address?.toLowerCase() ?? null],
    enabled: Boolean(address && client),
    // Names change rarely and the fallback is always available, so this can be
    // held for a long time.
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
    queryFn: async () => (address && client ? await resolveBnbName(client, address) : null),
  });

  return data ?? null;
}
