import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Address } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(address: string, chars = 4) {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

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

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatRelative(iso: string, now = new Date('2026-08-27T12:00:00Z')) {
  const diff = now.getTime() - new Date(iso).getTime();
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
