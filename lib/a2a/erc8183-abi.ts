/**
 * ERC-8183 AgenticCommerce kernel - the job/escrow contract Bazar settles through.
 *
 * This replaces the bespoke "Bazar escrow" that earlier builds encoded calldata
 * for. That contract never existed on BNB Chain. ERC-8183 does: the deployed
 * kernel address for each network is in `lib/chain/addresses.ts`, taken from the
 * official BNB Agent Studio SDK's deployment manifest.
 *
 * Lifecycle:
 *   createJob(provider, evaluator, expiredAt, description, hook) -> jobId
 *   fund(jobId, expectedBudget, optParams)      client sets the budget here
 *   ...provider works and submits a deliverable...
 *   complete(jobId, reason, optParams)          evaluator releases payment
 *   reject(jobId, reason, optParams)            evaluator rejects
 *   claimRefund(jobId)                          client reclaims after expiry
 *
 * Bazar never signs any of these. It resolves the provider from the ERC-8004
 * Identity Registry and hands back an unsigned `createJob` intent; the budget is
 * chosen by the client at `fund` time, because no price exists on chain.
 *
 * `getJob(uint256)` is deliberately absent from the typed ABI below: its return
 * struct is defined by the kernel implementation, not by anything Bazar can
 * verify from the addresses manifest, and publishing a guessed tuple would be
 * exactly the kind of invented contract this build is removing. Read job state
 * with the ABI shipped in the BNB Agent Studio SDK.
 */

export const ERC8183_ABI = [
  {
    type: 'function',
    name: 'createJob',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'provider', type: 'address' },
      { name: 'evaluator', type: 'address' },
      { name: 'expiredAt', type: 'uint256' },
      { name: 'description', type: 'string' },
      { name: 'hook', type: 'address' },
    ],
    outputs: [{ name: 'jobId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'fund',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
      { name: 'expectedBudget', type: 'uint256' },
      { name: 'optParams', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'complete',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
      { name: 'reason', type: 'bytes32' },
      { name: 'optParams', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'reject',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
      { name: 'reason', type: 'bytes32' },
      { name: 'optParams', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimRefund',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'event',
    name: 'JobCreated',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'provider', type: 'address', indexed: true },
      { name: 'evaluator', type: 'address', indexed: false },
      { name: 'expiredAt', type: 'uint256', indexed: false },
      { name: 'hook', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'JobFunded',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'provider', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'JobSubmitted',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'provider', type: 'address', indexed: true },
      { name: 'deliverable', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'JobCompleted',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'evaluator', type: 'address', indexed: true },
      { name: 'reason', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PaymentReleased',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'provider', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

/** Human-readable function signatures, for selectors and for the docs page. */
export const ERC8183_FUNCTION_SIGNATURES = {
  createJob: 'createJob(address,address,uint256,string,address)',
  fund: 'fund(uint256,uint256,bytes)',
  complete: 'complete(uint256,bytes32,bytes)',
  reject: 'reject(uint256,bytes32,bytes)',
  claimRefund: 'claimRefund(uint256)',
  /** Read-only; return struct comes from the BNB Agent Studio SDK, not from Bazar. */
  getJob: 'getJob(uint256)',
} as const;

export const ERC8183_EVENT_SIGNATURES = {
  JobCreated: 'JobCreated(uint256,address,address,address,uint256,address)',
  JobFunded: 'JobFunded(uint256,address,address,uint256)',
  JobSubmitted: 'JobSubmitted(uint256,address,bytes32)',
  JobCompleted: 'JobCompleted(uint256,address,bytes32)',
  PaymentReleased: 'PaymentReleased(uint256,address,uint256)',
} as const;

/** No hook contract - the kernel treats the zero address as "no hook". */
export const NO_HOOK = '0x0000000000000000000000000000000000000000' as const;

/** `optParams` when the caller has nothing extra to pass. */
export const NO_OPT_PARAMS = '0x' as const;
