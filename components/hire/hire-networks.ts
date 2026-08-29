/**
 * Network and expiry choices for the hire flow.
 *
 * The AgenticCommerce kernel is deployed on BNB Smart Chain (56) and BSC
 * Testnet (97). Both work. They are not interchangeable, and the flow says so:
 * the settlement policy differs by an order of magnitude, so a hirer who is
 * rehearsing should be on testnet and a hirer who means it should know what a
 * mainnet commitment costs them in time.
 *
 * Nothing in this file is a guess. The expiry bounds were binary-searched
 * against both live kernels on 2026-08-28; the quorum and dispute-window
 * figures are read live from `OptimisticPolicy` at render time rather than
 * baked in here.
 */

import { BSC_MAINNET, BSC_TESTNET, type SupportedChainId } from '@/lib/chain/addresses';

export const HIRE_CHAIN_IDS: readonly SupportedChainId[] = [BSC_TESTNET, BSC_MAINNET];

export function isSupportedHireChain(chainId: number | undefined): chainId is SupportedChainId {
  return chainId === BSC_MAINNET || chainId === BSC_TESTNET;
}

export interface HireChainMeta {
  chainId: SupportedChainId;
  name: string;
  shortName: string;
  /** True when a mistake here costs real money. */
  liveFunds: boolean;
  /** One line on what committing here actually means. */
  stake: string;
}

export const HIRE_CHAIN_META: Record<SupportedChainId, HireChainMeta> = {
  [BSC_TESTNET]: {
    chainId: BSC_TESTNET,
    name: 'BSC Testnet',
    shortName: 'Testnet',
    liveFunds: false,
    stake: 'Test funds. The full journey runs end to end, and settles in minutes.',
  },
  [BSC_MAINNET]: {
    chainId: BSC_MAINNET,
    name: 'BNB Smart Chain',
    shortName: 'Mainnet',
    liveFunds: true,
    stake: 'Real funds. The budget leaves your wallet and is held by the kernel.',
  },
};

/* ------------------------------------------------------------------ */
/* Expiry                                                              */
/* ------------------------------------------------------------------ */

/**
 * `createJob` reverts `ExpiryTooShort()` unless `expiredAt` is more than 300
 * seconds past the timestamp of the block that MINES the call - measured by
 * bisection on the live testnet kernel: `head + 300` and `head + 301` both
 * reverted, `head + 305` passed, because the head moves while the call is in
 * flight. `MAX_EXPIRY_SECONDS` (365 days) passed at the boundary.
 *
 * The options below start an order of magnitude above the floor, for a reason
 * that is not theoretical: while probing, testnet jobs 726, 727 and 728 were
 * created with roughly five-minute expiries and their expiry elapsed before
 * they were funded. `fund` then reverts `WrongStatus()` even though the job
 * still reports status OPEN. A hirer needs time to sign three transactions,
 * so the shortest option offered here is an hour.
 */
export interface HireDuration {
  id: string;
  label: string;
  seconds: number;
  /** Shown under the option: what the window is actually for. */
  note: string;
}

export const HIRE_DURATIONS: readonly HireDuration[] = [
  { id: '1h', label: '1 hour', seconds: 3_600, note: 'Tight. Enough for a live demo run.' },
  { id: '24h', label: '24 hours', seconds: 86_400, note: 'The default. Room for the agent to work.' },
  { id: '7d', label: '7 days', seconds: 604_800, note: 'Matches the mainnet dispute window.' },
  { id: '30d', label: '30 days', seconds: 2_592_000, note: 'Long-running work.' },
] as const;

export const DEFAULT_DURATION_ID = '24h';

export function durationById(id: string): HireDuration {
  return HIRE_DURATIONS.find((d) => d.id === id) ?? HIRE_DURATIONS[1]!;
}

/**
 * Render a duration in seconds as words. Used for the live-read dispute window,
 * which is a `uint64` the policy admin can change, so this handles any value
 * rather than switching over the two we happen to have measured.
 */
export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'no window';
  if (seconds < 90) return `${Math.round(seconds)} seconds`;
  const minutes = seconds / 60;
  if (minutes < 90) return `${Math.round(minutes)} minutes`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours)} hours`;
  const days = hours / 24;
  return `${Math.round(days)} ${Math.round(days) === 1 ? 'day' : 'days'}`;
}

/**
 * Format a unix second as a fixed UTC string.
 *
 * Deliberately not locale-formatted and deliberately not relative: the value
 * comes from the chain, the render must not depend on a browser clock, and the
 * server and client must agree. `expiredAt` is what the kernel compares against
 * `block.timestamp`, so it is shown as the absolute instant it is.
 */
export function formatChainTimestamp(unixSeconds: number): string {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return '-';
  const iso = new Date(unixSeconds * 1000).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
