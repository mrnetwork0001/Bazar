/**
 * Compatibility shim.
 *
 * The hand-written ERC-8183 ABI that used to live here is gone. It has been
 * replaced by the real artifact published by the BNB Agent Studio SDK, vendored
 * verbatim in `lib/abi/agentic-commerce.ts`. The hand-written version was a
 * subset, it omitted `setBudget`, `setProvider`, `submit` and `jobHasBudget`,
 * and it deliberately refused to declare `getJob` because its return tuple was
 * unverifiable at the time. All of that is now measured and vendored.
 *
 * This file exists only so the existing A2A importers keep resolving. New code
 * should import from `@/lib/abi` directly.
 */

import { getDeployment, type SupportedChainId } from '@/lib/chain/addresses';
import {
  AGENTIC_COMMERCE_ABI,
  AGENTIC_COMMERCE_EVENT_SIGNATURES,
  AGENTIC_COMMERCE_FUNCTION_SIGNATURES,
} from '@/lib/abi';
import type { Address } from '@/lib/types';

/** @deprecated Import `AGENTIC_COMMERCE_ABI` from `@/lib/abi`. */
export const ERC8183_ABI = AGENTIC_COMMERCE_ABI;

/** @deprecated Import `AGENTIC_COMMERCE_FUNCTION_SIGNATURES` from `@/lib/abi`. */
export const ERC8183_FUNCTION_SIGNATURES = AGENTIC_COMMERCE_FUNCTION_SIGNATURES;

/** @deprecated Import `AGENTIC_COMMERCE_EVENT_SIGNATURES` from `@/lib/abi`. */
export const ERC8183_EVENT_SIGNATURES = AGENTIC_COMMERCE_EVENT_SIGNATURES;

export { NO_OPT_PARAMS, ZERO_REASON } from '@/lib/abi';

/**
 * The zero address, formerly exported as "no hook".
 *
 * IT IS NOT A VALID HOOK. Simulated against the live kernel on both chains on
 * 2026-08-28: `createJob` with a zero `hook` reverts `HookRequired()`, and with
 * a zero `evaluator` reverts `ZeroAddress()`. Any calldata built with this
 * constant is calldata that cannot be mined. Every one of the 1,327 real jobs
 * sampled across both chains carries a non-zero hook.
 *
 * @deprecated Use `requiredHook(chainId)`.
 */
export const NO_HOOK = '0x0000000000000000000000000000000000000000' as const;

/**
 * The hook and evaluator a job on this chain should carry: the deployment's
 * EvaluatorRouter. Confirmed on real mainnet job 56664, where `evaluator` and
 * `hook` are both `0x51895229…D6DA`, and on the overwhelming majority of every
 * other job sampled on both chains.
 */
export function requiredHook(chainId: SupportedChainId): Address {
  return getDeployment(chainId).evaluatorRouter;
}
