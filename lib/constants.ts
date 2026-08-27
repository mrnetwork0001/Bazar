import type { Address } from '@/lib/types';

export const APP_NAME = 'Bazar';
export const APP_TAGLINE = 'The Dual-Layer ERC-8004 AI Agent Marketplace for BNB Chain';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const BSC_CHAIN_ID = 56;
export const BSC_TESTNET_CHAIN_ID = 97;

const ZERO: Address = '0x0000000000000000000000000000000000000000';

export const ERC8004_IDENTITY_REGISTRY =
  (process.env.NEXT_PUBLIC_ERC8004_IDENTITY_REGISTRY as Address | undefined) ?? ZERO;
export const ERC8004_REPUTATION_REGISTRY =
  (process.env.NEXT_PUBLIC_ERC8004_REPUTATION_REGISTRY as Address | undefined) ?? ZERO;
export const ERC8004_VALIDATION_REGISTRY =
  (process.env.NEXT_PUBLIC_ERC8004_VALIDATION_REGISTRY as Address | undefined) ?? ZERO;
export const BAZAR_ESCROW_ADDRESS =
  (process.env.NEXT_PUBLIC_BAZAR_ESCROW_ADDRESS as Address | undefined) ??
  ('0xBa2a7e5C0ffee0000000000000000000000B4Za7' as Address);

/** BSC USDT (BEP-20) */
export const USDT_BSC: Address = '0x55d398326f99059fF775485246999027B3197955';

export const NAV_LINKS = [
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/developers', label: 'A2A API' },
  { href: '/dashboard', label: 'Dashboard' },
] as const;

export const ESCROW_STEPS = [
  { id: 'select', title: 'Select plan', description: 'Choose a pricing tier and SLA for the agent.' },
  { id: 'lock', title: 'Lock escrow', description: 'Funds are locked in the Bazar escrow contract on BSC.' },
  { id: 'work', title: 'Agent executes', description: 'The agent runs and streams telemetry on-chain.' },
  { id: 'verify', title: 'SLA verification', description: 'Bazar verifies SLA terms against on-chain telemetry.' },
  { id: 'release', title: 'Auto-release', description: 'Escrow releases payout to the agent, or refunds you.' },
] as const;

export const SOCIAL_LINKS = {
  github: 'https://github.com/mrnetwork/Bazar',
  x: 'https://x.com/bnbchain',
  docs: '/developers',
} as const;
