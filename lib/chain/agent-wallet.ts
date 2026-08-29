/**
 * The address an agent is paid at, read from the chain.
 *
 * This exists because the index is not good enough to pay. `agent.owner` from
 * 8004scan is an indexer's claim about the registry; escrow moves real funds,
 * so the provider is resolved against the Identity Registry itself.
 *
 * It is also chain-specific, which is the subtle part. An ERC-8004 token id
 * means a different agent on each network: token 1776 resolves to
 * 0x3C005172... on BSC testnet and 0xFC619f08... on BSC mainnet. Reading the
 * wallet from one chain and funding a job on another sends money to whoever
 * happens to hold that id on the destination chain, and every zero-address and
 * registry-unreachable guard still passes, because the lookup succeeded
 * perfectly against the wrong registry. Callers must pass the chain they are
 * settling on, not the chain they discovered the agent on.
 */

import { IDENTITY_REGISTRY_ABI } from '@/lib/abi';
import { getDeployment, type SupportedChainId } from '@/lib/chain/addresses';
import { getPublicClient } from '@/lib/chain/client';
import type { Address } from '@/lib/types';

const ZERO = '0x0000000000000000000000000000000000000000';

/**
 * Resolve the payable wallet for `tokenId` on `chainId`.
 *
 * Tries `getAgentWallet` first, since an agent may nominate an operating
 * wallet distinct from the identity's owner, then falls back to `ownerOf`.
 * Returns null when neither answers or both answer with the zero address -
 * a refusal, never a reason to fall back to indexed data.
 */
export async function readAgentWallet(
  chainId: SupportedChainId,
  tokenId: string,
): Promise<Address | null> {
  let id: bigint;
  try {
    id = BigInt(tokenId);
  } catch {
    return null;
  }

  const client = getPublicClient(chainId);
  const address = getDeployment(chainId).identityRegistry;

  for (const functionName of ['getAgentWallet', 'ownerOf'] as const) {
    try {
      const result = (await client.readContract({
        address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName,
        args: [id],
      })) as Address;
      if (result && result !== ZERO) return result;
    } catch {
      // Try the next lookup. A registry that cannot answer is a refusal, and
      // the caller renders that rather than guessing an address.
    }
  }
  return null;
}
