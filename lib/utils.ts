import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Address } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * "0x8004…a432". Returns the value untouched when it is already shorter than
 * the truncation would be: the naive slice on a short string repeats its own
 * characters on both sides of the ellipsis ("0x1234…0x1234"), which reads as a
 * longer address than the one actually held.
 */
export function shortAddress(address: string, chars = 4) {
  if (!address) return '';
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

/**
 * Currency and percentage formatters, for the demo ledger that has since been removed ONLY.
 *
 * Nothing Bazar reads from the ERC-8004 registries is a price, a percentage
 * return or a rate: the registries publish identity and reputation, and the
 * indexer publishes neither a fee nor a quote. If one of these is about to
 * render a number that came from the index, the number is invented and the fix
 * is to render the absence instead, not to reach for a formatter.
 */
export function formatUsd(value: number, opts: { compact?: boolean; decimals?: number } = {}) {
  const { compact = true, decimals } = opts;
  if (compact) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: decimals ?? 1,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: decimals ?? 0,
  }).format(value);
}

export function formatNumber(value: number, opts: { compact?: boolean; decimals?: number } = {}) {
  const { compact = true, decimals } = opts;
  return new Intl.NumberFormat('en-US', {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: decimals ?? 1,
  }).format(value);
}

/** Formats a percent with sign, e.g. +4.20% / -1.10% */
export function formatPct(value: number, opts: { sign?: boolean; decimals?: number } = {}) {
  const { sign = true, decimals = 2 } = opts;
  const fixed = Math.abs(value).toFixed(decimals);
  if (!sign) return `${fixed}%`;
  if (value > 0) return `+${fixed}%`;
  if (value < 0) return `-${fixed}%`;
  return `${fixed}%`;
}

export function formatToken(value: number, currency: string) {
  const decimals = currency === 'BNB' ? 3 : 2;
  return `${value.toLocaleString('en-US', { maximumFractionDigits: decimals })} ${currency}`;
}

/**
 * Shown wherever a timestamp cannot be read. The index guarantees `created_at`
 * and `updated_at` are strings, not that they parse, and "Invalid Date" on an
 * agent page reads like a Bazar bug rather than a gap in the record.
 */
export const UNKNOWN_DATE = 'Unknown';

/**
 * Registry timestamps are rendered in UTC, not in the render machine's zone, so
 * a server render and a client render of the same ISO string can never disagree
 * - and the date matches the one BscScan shows for the same transaction.
 */
export function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return UNKNOWN_DATE;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * `now` is required on purpose. A default would freeze the clock at build time
 * (or at whatever date the default was written), which is how every dashboard
 * timestamp came to be a day understated. Callers compute the clock once on the
 * server and thread it down as a prop, so server and client render the identical
 * string and hydration stays clean.
 */
export function formatRelative(iso: string, now: Date) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return UNKNOWN_DATE;
  const diff = now.getTime() - then;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const suffix = diff >= 0 ? 'ago' : 'from now';
  if (minutes < 60) return `${minutes}m ${suffix}`;
  if (hours < 48) return `${hours}h ${suffix}`;
  return `${days}d ${suffix}`;
}

export function periodLabel(period: 'task' | 'day' | 'week' | 'month') {
  return { task: '/ task', day: '/ day', week: '/ week', month: '/ month' }[period];
}

export function isAddress(value: unknown): value is Address {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function bscScanAddress(address: string, chainId: number = 56) {
  const base = chainId === 97 ? 'https://testnet.bscscan.com' : 'https://bscscan.com';
  return `${base}/address/${address}`;
}

export function bscScanTx(tx: string, chainId: number = 56) {
  const base = chainId === 97 ? 'https://testnet.bscscan.com' : 'https://bscscan.com';
  return `${base}/tx/${tx}`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Trim text to a length without cutting a word in half.
 *
 * CSS `line-clamp` ends a paragraph wherever the line box runs out, which is
 * frequently the middle of a word - "Monitors the positio…" - and reads as a
 * rendering fault rather than as an abbreviation. Registry descriptions are
 * arbitrary text written by strangers, so this is the common case, not the
 * edge one.
 *
 * The cut falls back to the last space inside the budget and then drops any
 * trailing punctuation, so a clause ending in a comma does not become
 * "Optimism,…". If a single word is longer than the budget there is no space to
 * fall back to and it is cut where it must be, which is the one case where the
 * alternative is worse.
 */
export function truncateWords(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;

  const cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  const body = lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${body.replace(/[\s,;:.\-–—]+$/, '')}…`;
}
