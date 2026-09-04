/**
 * Feedback records, read from the ERC-8004 Reputation Registry.
 *
 * The index publishes a feedback *count* and an aggregate score; it does not
 * publish the records themselves. Those live only on chain, so this reads them
 * from the registry directly.
 *
 * Two things a caller should know. The counts disagree: for agent 49637 the
 * index reported 3 feedbacks while the registry returned 7 records, because
 * the index aggregates differently from the raw log. Bazar shows the registry's
 * records and the registry's count beside them, so what is listed and what is
 * claimed always come from the same place.
 *
 * And there is no comment text. ERC-8004 feedback is a signed value plus up to
 * two tags - "starred", "soccer" - not prose. Anything that looked like a
 * written review here would be invented, so this renders who, what value, which
 * tags, and whether it was later revoked.
 */

import { REPUTATION_REGISTRY_ABI } from '@/lib/abi';
import { getDeployment, type SupportedChainId } from '@/lib/chain/addresses';
import { getPublicClient } from '@/lib/chain/client';
import type { Address } from '@/lib/types';

export interface FeedbackRecord {
  /** The address that left it. */
  client: Address;
  /** Per-client index, so the same client can leave more than one. */
  index: number;
  /** Already scaled by the record's own decimals. */
  value: number;
  tag1: string;
  tag2: string;
  revoked: boolean;
}

export type FeedbackResult =
  | { ok: true; records: FeedbackRecord[] }
  /** The registry could not be read. Distinct from "no feedback exists". */
  | { ok: false; reason: string };

/**
 * Every feedback record for an agent, newest last as the registry returns them.
 *
 * Revoked records are included so the UI can show that a rating was withdrawn
 * rather than silently dropping it - an agent whose feedback was pulled is a
 * different claim from an agent that never had any.
 */
export async function readAgentFeedback(
  chainId: SupportedChainId,
  tokenId: string,
): Promise<FeedbackResult> {
  let id: bigint;
  try {
    id = BigInt(tokenId);
  } catch {
    return { ok: false, reason: 'Malformed token id.' };
  }

  try {
    const client = getPublicClient(chainId);
    const result = (await client.readContract({
      address: getDeployment(chainId).reputationRegistry,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'readAllFeedback',
      // No client filter, no tag filter, and revoked records included.
      args: [id, [], '', '', true],
    })) as readonly [
      readonly Address[],
      readonly bigint[],
      readonly bigint[],
      readonly number[],
      readonly string[],
      readonly string[],
      readonly boolean[],
    ];

    const [clients, indexes, values, decimals, tag1s, tag2s, revoked] = result;

    const records: FeedbackRecord[] = clients.map((c, i) => {
      const dp = Number(decimals[i] ?? 0);
      return {
        client: c,
        index: Number(indexes[i] ?? 0),
        // int128 scaled by its own decimals; a record may legitimately be
        // negative, so this is not clamped.
        value: Number(values[i] ?? 0n) / 10 ** dp,
        tag1: tag1s[i] ?? '',
        tag2: tag2s[i] ?? '',
        revoked: Boolean(revoked[i]),
      };
    });

    return { ok: true, records };
  } catch (err) {
    return { ok: false, reason: (err as Error)?.message?.split('\n')[0] ?? 'Registry unreachable.' };
  }
}
