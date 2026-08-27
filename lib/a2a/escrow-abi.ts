/**
 * Minimal ABI for the Bazar escrow contract on BNB Smart Chain.
 *
 * Flow: the hiring agent calls `lockEscrow` with the calldata returned by
 * POST /api/v1/a2a/hire (value = amount for BNB tiers, or approve + call for
 * USDT). Bazar's SLA verifier then calls `release` (SLA met) or `refund`
 * (SLA missed). Every transition emits an event the caller can subscribe to.
 */
export const ESCROW_ABI = [
  {
    type: 'function',
    name: 'lockEscrow',
    stateMutability: 'payable',
    inputs: [
      { name: 'agentTokenId', type: 'uint256' },
      { name: 'hireId', type: 'bytes32' },
      { name: 'payer', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'release',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'hireId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refund',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'hireId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'event',
    name: 'EscrowLocked',
    inputs: [
      { name: 'hireId', type: 'bytes32', indexed: true },
      { name: 'agentTokenId', type: 'uint256', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EscrowReleased',
    inputs: [
      { name: 'hireId', type: 'bytes32', indexed: true },
      { name: 'agentTokenId', type: 'uint256', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EscrowRefunded',
    inputs: [
      { name: 'hireId', type: 'bytes32', indexed: true },
      { name: 'agentTokenId', type: 'uint256', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

/** Human-readable signatures, handy for selectors and docs. */
export const ESCROW_FUNCTION_SIGNATURES = {
  lockEscrow: 'lockEscrow(uint256,bytes32,address,uint256)',
  release: 'release(bytes32)',
  refund: 'refund(bytes32)',
} as const;

export const ESCROW_EVENT_SIGNATURES = {
  EscrowLocked: 'EscrowLocked(bytes32,uint256,address,uint256)',
  EscrowReleased: 'EscrowReleased(bytes32,uint256,address,uint256)',
  EscrowRefunded: 'EscrowRefunded(bytes32,uint256,address,uint256)',
} as const;
