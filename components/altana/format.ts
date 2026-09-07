/**
 * Display helpers for the permissions surface.
 *
 * Every "how long left" answer takes the chain's head timestamp as an argument
 * rather than reading a clock: expiry is compared against `block.timestamp` by
 * both the KeyStore and the account, and a countdown drawn from the browser
 * would disagree with the contract that actually decides.
 */

import { formatUnits } from 'viem';

import type { SpendPeriod } from '@/lib/altana/abi';
import { formatSeconds } from '@/components/hire/hire-networks';

/**
 * A token amount, trimmed but never rounded up into a lie.
 *
 * Amounts below the display precision come back as "< 0.0001" rather than
 * "0.0000", because a cap that reads as zero when it is not is worse than an
 * inequality.
 */
export function formatAmount(value: bigint, decimals: number, maxFractionDigits = 4): string {
  const text = formatUnits(value, decimals);
  const [whole, fraction = ''] = text.split('.');
  if (!fraction) return whole ?? '0';
  const trimmed = fraction.slice(0, maxFractionDigits).replace(/0+$/, '');
  if (trimmed) return `${whole}.${trimmed}`;
  if (value === 0n) return '0';
  if (whole !== '0') return whole ?? '0';
  return `< 0.${'0'.repeat(maxFractionDigits - 1)}1`;
}

/** "per day", "per hour" - the window a spend cap refills over. */
export function periodPhrase(period: SpendPeriod | null): string {
  return period ? `per ${period}` : 'per unknown period';
}

export type ExpiryTone = 'live' | 'soon' | 'expired' | 'never' | 'unknown';

export interface ExpiryState {
  tone: ExpiryTone;
  /** Short label for a badge. */
  short: string;
  /** Sentence-length description. */
  long: string;
}

/**
 * How an expiry stands against the chain's own clock.
 *
 * `chainTime` null means the head block could not be read, and that is reported
 * as unknown rather than assumed to be now.
 */
export function expiryState(expiry: number, chainTime: number | null): ExpiryState {
  if (expiry === 0) {
    return {
      tone: 'never',
      short: 'No expiry',
      long: 'This key was registered with no expiry. Only a revoke ends it.',
    };
  }
  if (chainTime === null) {
    return {
      tone: 'unknown',
      short: 'Expiry unknown',
      long: 'The head block could not be read, so how this expiry stands right now is unknown.',
    };
  }
  const remaining = expiry - chainTime;
  if (remaining <= 0) {
    return {
      tone: 'expired',
      short: 'Expired',
      long: `Expired ${formatSeconds(-remaining)} ago by the chain's own clock. The account refuses it.`,
    };
  }
  return {
    tone: remaining < 3_600 ? 'soon' : 'live',
    short: `${formatSeconds(remaining)} left`,
    long: `Lapses in ${formatSeconds(remaining)}, measured against the head block.`,
  };
}

/** Middle-truncate a 32-byte id so both ends stay checkable. */
export function shortHex(value: string, lead = 10, tail = 6): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}
