/**
 * Vendored contract ABIs.
 *
 * Every file in this directory is a verbatim copy of an artifact published by
 * the official BNB Agent Studio SDK (bnb-chain/bnbagent-sdk, `abis/`). None of
 * it is hand-written, and nothing here should be edited by hand: if a contract
 * is upgraded, re-copy the SDK artifact.
 *
 * Human-readable signatures are *derived* from those ABIs below rather than
 * typed out a second time, so the docs page and the encoder can never disagree.
 */

import { toEventSignature, toFunctionSignature } from 'viem';
import type { AbiEvent, AbiFunction } from 'viem';

import { AGENTIC_COMMERCE_ABI } from './agentic-commerce';

export { AGENTIC_COMMERCE_ABI } from './agentic-commerce';
export { EVALUATOR_ROUTER_ABI } from './evaluator-router';
export { ERC20_ABI } from './erc20';
export { IDENTITY_REGISTRY_ABI } from './identity-registry';

function fnSig(name: string): string {
  const item = AGENTIC_COMMERCE_ABI.find(
    (entry): entry is Extract<typeof entry, { type: 'function' }> =>
      entry.type === 'function' && entry.name === name,
  );
  if (!item) throw new Error(`AgenticCommerce ABI has no function "${name}"`);
  return toFunctionSignature(item as unknown as AbiFunction);
}

function evSig(name: string): string {
  const item = AGENTIC_COMMERCE_ABI.find(
    (entry): entry is Extract<typeof entry, { type: 'event' }> =>
      entry.type === 'event' && entry.name === name,
  );
  if (!item) throw new Error(`AgenticCommerce ABI has no event "${name}"`);
  return toEventSignature(item as unknown as AbiEvent);
}

/**
 * Canonical function signatures, derived from the vendored ABI.
 *
 * `setBudget` is listed alongside `fund` on purpose: measured against the live
 * kernel, `fund` reverts `ZeroBudget()` unless a budget was already written by
 * `setBudget`. The budget is not a `fund` argument - `fund`'s second argument
 * is an *assertion* about the stored budget and reverts `BudgetMismatch()` when
 * it disagrees.
 */
export const AGENTIC_COMMERCE_FUNCTION_SIGNATURES = {
  createJob: fnSig('createJob'),
  setProvider: fnSig('setProvider'),
  setBudget: fnSig('setBudget'),
  fund: fnSig('fund'),
  submit: fnSig('submit'),
  complete: fnSig('complete'),
  reject: fnSig('reject'),
  claimRefund: fnSig('claimRefund'),
  getJob: fnSig('getJob'),
  jobCounter: fnSig('jobCounter'),
  jobHasBudget: fnSig('jobHasBudget'),
} as const;

/** Canonical event signatures, derived from the vendored ABI. */
export const AGENTIC_COMMERCE_EVENT_SIGNATURES = {
  JobCreated: evSig('JobCreated'),
  BudgetSet: evSig('BudgetSet'),
  ProviderSet: evSig('ProviderSet'),
  JobFunded: evSig('JobFunded'),
  JobSubmitted: evSig('JobSubmitted'),
  JobCompleted: evSig('JobCompleted'),
  JobRejected: evSig('JobRejected'),
  JobExpired: evSig('JobExpired'),
  PaymentReleased: evSig('PaymentReleased'),
  Refunded: evSig('Refunded'),
} as const;

/** `optParams` when the caller has nothing extra to pass. */
export const NO_OPT_PARAMS = '0x' as const;

/** `reason` when the caller has no bytes32 reason code to attach. */
export const ZERO_REASON = `0x${'00'.repeat(32)}` as const;

/**
 * `deliverable` on a job that has not been submitted. Measured on 1,327 real
 * jobs across both chains: `deliverable == ZERO_DELIVERABLE` holds if and only
 * if `submittedAt == 0`, with no exceptions.
 */
export const ZERO_DELIVERABLE = ZERO_REASON;

/**
 * Kernel expiry bounds, binary-searched against the live kernel on 2026-08-28.
 * `createJob` reverts `ExpiryTooShort()` below the minimum and `ExpiryTooLong()`
 * above `MAX_EXPIRY_DURATION`. Identical on both chains.
 */
export const MIN_EXPIRY_SECONDS = 300;
export const MAX_EXPIRY_SECONDS = 31_536_000;
export { REPUTATION_REGISTRY_ABI } from './reputation-registry';
