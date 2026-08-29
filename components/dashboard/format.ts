/**
 * Time formatting for onchain timestamps.
 *
 * Everything here takes its reference clock as an argument. The kernel compares
 * `expiredAt` against `block.timestamp` and nothing else, so "expired" on this
 * page means "expired according to the chain's head block", never according to
 * the visitor's machine. That is why there is no `Date.now()` in this file and
 * why `formatDelta` has no default for `now`: a default would silently
 * reintroduce the browser clock the moment a caller forgot to thread the chain
 * time through.
 *
 * `new Date(seconds * 1000)` is used only to turn a known unix second into UTC
 * calendar parts. It never reads the current time.
 */

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

/** "12 Sep 2026, 14:03 UTC" - the same instant BscScan shows for the block. */
export function formatUtcDateTime(unixSeconds: number): string {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return 'Not set';
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return `${date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })} UTC`;
}

/**
 * "in 6d 4h" / "3h 12m ago", measured between two unix seconds.
 *
 * Returns null when either value is missing, so a caller renders nothing rather
 * than a duration computed against an unknown clock.
 */
export function formatDelta(target: number, now: number | null): string | null {
  if (now === null || !Number.isFinite(target) || target <= 0) return null;
  const diff = target - now;
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? '' : ' ago';
  const prefix = diff >= 0 ? 'in ' : '';

  if (abs < MINUTE) return `${prefix}${abs}s${suffix}`;
  if (abs < HOUR) {
    const m = Math.floor(abs / MINUTE);
    return `${prefix}${m}m${suffix}`;
  }
  if (abs < DAY) {
    const h = Math.floor(abs / HOUR);
    const m = Math.floor((abs % HOUR) / MINUTE);
    return `${prefix}${h}h${m > 0 ? ` ${m}m` : ''}${suffix}`;
  }
  const d = Math.floor(abs / DAY);
  const h = Math.floor((abs % DAY) / HOUR);
  return `${prefix}${d}d${h > 0 ? ` ${h}h` : ''}${suffix}`;
}

/** "43,200 blocks" with thousands separators, for the scan-coverage report. */
export function formatBlockCount(count: bigint): string {
  return count.toLocaleString('en-US');
}
