/**
 * .bnb name resolution, via SPACE ID's BNB Name Service.
 *
 * A marketplace on BNB Chain should call people by their BNB Chain name. The
 * index already surfaces `.eth` names for agent owners because 8004scan
 * resolves those; nothing resolves `.bnb`, so Bazar does it here.
 *
 * BNS is ENS-shaped, so reverse resolution is the familiar three steps:
 *   1. node = namehash("<address without 0x, lowercased>.addr.reverse")
 *   2. registry.resolver(node) -> the resolver that owns that record
 *   3. resolver.name(node)     -> the name
 *
 * Verified against the live registry on 2026-09-02: `bnb.bnb` resolves forward
 * to 0x2Fe5A31A678A114a297B18dEC7771601fdCDec9f, and that address reverses to
 * `123.bnb`. Most addresses have no reverse record at all, which is not an
 * error - it is the normal case, and callers render the address instead.
 */

import { namehash, type Address, type PublicClient } from 'viem';

/** SPACE ID BNSRegistry on BNB Smart Chain. */
export const BNS_REGISTRY: Address = '0x0000000092F9d53192ED545D9dF4fDE3C624cBf0';

const ZERO = '0x0000000000000000000000000000000000000000';

const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'resolver',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
] as const;

const RESOLVER_ABI = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ type: 'string' }],
  },
] as const;

/**
 * The reverse record for `address`, or null when it has none.
 *
 * Never throws: a name is a nicety, and a resolver that is unreachable or a
 * record that does not exist must degrade to showing the address rather than
 * breaking the surface that asked.
 */
export async function resolveBnbName(client: PublicClient, address: Address): Promise<string | null> {
  try {
    const node = namehash(`${address.toLowerCase().slice(2)}.addr.reverse`);

    const resolver = (await client.readContract({
      address: BNS_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: 'resolver',
      args: [node],
    })) as Address;
    if (!resolver || resolver === ZERO) return null;

    const name = (await client.readContract({
      address: resolver,
      abi: RESOLVER_ABI,
      functionName: 'name',
      args: [node],
    })) as string;

    const trimmed = name?.trim();
    if (!trimmed) return null;

    // A reverse record is a claim by whoever set it, not proof. Only names in
    // the namespace BNS actually governs are shown; anything else could be an
    // arbitrary string pointed at someone else's identity.
    return trimmed.endsWith('.bnb') ? trimmed : null;
  } catch {
    return null;
  }
}
