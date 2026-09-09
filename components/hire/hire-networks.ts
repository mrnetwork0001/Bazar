/**
 * Network and expiry choices for the hire flow.
 *
 * The AgenticCommerce kernel is deployed on BNB Smart Chain (56) and BSC
 * Testnet (97), but Bazar settles on mainnet only: an ERC-8004 token id
 * resolves to a different agent on each network, so mixing them invites paying
 * the wrong party. What remains here is mainnet's own commitment - a 3-of-5
 * quorum and a 7-day dispute window - which a hirer should understand before
 * locking funds.
 *
 * Nothing in this file is a guess. The expiry bounds were binary-searched
 * against both live kernels on 2026-08-28; the quorum and dispute-window
 * figures are read live from `OptimisticPolicy` at render time rather than
 * baked in here.
 */

import { BSC_MAINNET, type SupportedChainId } from '@/lib/chain/addresses';

export const HIRE_CHAIN_IDS: readonly SupportedChainId[] = [BSC_MAINNET];

export function isSupportedHireChain(chainId: number | undefined): chainId is SupportedChainId {
  return chainId === BSC_MAINNET;
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

/**
 * Every option here leaves a provider room to answer.
 *
 * This is not a style choice. Jobs on this deployment route through the
 * OptimisticPolicy, which reverts `submit` with `SubmissionTooLate()`
 * (0x15e5dd74) once `now > expiredAt - disputeWindow`, and `disputeWindow()`
 * reads 604800 - seven days. A provider must therefore submit with MORE than
 * seven days left on the clock.
 *
 * The old options were 1 hour, 24 hours, 7 days and 30 days. Three of the four
 * created a job no agent could ever answer: the escrow locked, every submit
 * reverted, and the only possible outcome was expiry and a refund. Bazar's own
 * job #56744 was one of them - it was written off as "the agent was not
 * listening" when in fact no agent could have submitted against a one-hour
 * deadline. Verified on mainnet 2026-09-09: job #56747 with 6.2 days left
 * reverts SubmissionTooLate; #56759 with 8.0 days submitted fine.
 *
 * So the floor is the dispute window plus enough time for an agent to notice
 * and work. Anything shorter is not a tight deadline, it is a broken one.
 */
export const MIN_SUBMISSION_SLACK_SECONDS = 604_800;

export const HIRE_DURATIONS: readonly HireDuration[] = [
  {
    id: '10d',
    label: '10 days',
    seconds: 864_000,
    note: 'Three days for the agent, then the seven-day dispute window.',
  },
  {
    id: '14d',
    label: '14 days',
    seconds: 1_209_600,
    note: 'The default. A week to work, then the dispute window.',
  },
  { id: '30d', label: '30 days', seconds: 2_592_000, note: 'Long-running work.' },
  { id: '60d', label: '60 days', seconds: 5_184_000, note: 'Standing engagements.' },
] as const;

export const DEFAULT_DURATION_ID = '14d';

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
