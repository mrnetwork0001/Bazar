/**
 * Shared, server-safe marketplace configuration and URL param helpers.
 *
 * Imported by both the server page (to parse `searchParams`) and the client
 * controls (to parse `useSearchParams()`), so every control agrees on how
 * `?category=&q=&sort=&a2a=1&badge=&protocol=&minSla=` is interpreted.
 */
import { Grid3x3, HeartPulse, Scale, TrendingUp, type LucideIcon } from 'lucide-react';
import type { Agent, BadgeId, Category, CategoryId, Protocol } from '@/lib/types';
import { ALL_PROTOCOLS, type AgentQuery, type SortKey } from '@/lib/data/agents';
import { isCategoryId } from '@/lib/data/categories';
import { BADGE_META, type BadgeTone } from '@/components/ui/badge';
import { clamp } from '@/lib/utils';

/* ------------------------------- sorting -------------------------------- */

export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: 'reputation', label: 'Reputation' },
  { value: 'roi7d', label: '7-day ROI' },
  { value: 'sla', label: 'SLA score' },
  { value: 'hires', label: 'Most hired' },
  { value: 'price', label: 'Price: low to high' },
  { value: 'newest', label: 'Newest' },
];

export const DEFAULT_SORT: SortKey = 'reputation';

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === 'string' && SORT_OPTIONS.some((o) => o.value === value);
}

export function sortLabel(sort: SortKey): string {
  return SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Reputation';
}

/* ------------------------------ SLA slider ------------------------------ */

export const SLA_FLOOR = 90;
export const SLA_CEIL = 100;
export const SLA_STEP = 0.5;
export const SLA_PRESETS = [95, 97, 99] as const;

/* -------------------------------- badges -------------------------------- */

/** Display order for the badge checklist (trust signals first). */
export const BADGE_ORDER: BadgeId[] = [
  'erc8004-verified',
  'validated',
  'top-rated',
  'pancakeswap-top-trader',
  'venus-risk-monitor',
  'a2a-ready',
  'mcp-enabled',
  'fractional',
];

export function isBadgeId(value: string): value is BadgeId {
  return value in BADGE_META;
}

export function isProtocol(value: string): value is Protocol {
  return (ALL_PROTOCOLS as string[]).includes(value);
}

/* ------------------------------ categories ------------------------------ */

export const CATEGORY_ICONS: Record<Category['icon'], LucideIcon> = {
  Scale,
  Grid3x3,
  HeartPulse,
  TrendingUp,
};

export const CATEGORY_TONE: Record<Category['accent'], BadgeTone> = {
  rebalancing: 'cyan',
  grid: 'gold',
  health: 'emerald',
  yield: 'violet',
};

/** Full class strings so Tailwind's JIT can see them. */
export const CATEGORY_GLOW: Record<Category['accent'], string> = {
  rebalancing: 'hover:border-cyan-400/40 hover:shadow-glow-cyan',
  grid: 'hover:border-bnb/40 hover:shadow-glow',
  health: 'hover:border-emerald-400/40 hover:shadow-glow-emerald',
  yield: 'hover:border-violet-400/40 hover:shadow-glow-violet',
};

export const A2A_ACCENT_HEX = '#A78BFA';
export const BNB_HEX = '#F0B90B';

/** `#RRGGBB` (or `#RGB`) to `rgba(r, g, b, alpha)` for inline accent tints. */
export function withAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(240, 185, 11, ${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ------------------------------ URL params ------------------------------ */

export const PARAM_KEYS = ['category', 'q', 'sort', 'a2a', 'badge', 'protocol', 'minSla'] as const;
export type ParamKey = (typeof PARAM_KEYS)[number];

export type RawParams = Record<string, string | string[] | undefined>;

export interface MarketplaceParams {
  category?: CategoryId;
  q?: string;
  sort: SortKey;
  a2aOnly: boolean;
  badges: BadgeId[];
  protocols: Protocol[];
  minSla?: number;
}

const MAX_QUERY_LENGTH = 80;

function firstParam(value: string | string[] | undefined | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/** Accepts `a,b` and/or repeated keys; trims, de-duplicates, drops empties. */
export function parseList(value: string | string[] | undefined | null): string[] {
  if (value === undefined || value === null) return [];
  const parts = (Array.isArray(value) ? value : [value]).flatMap((v) => v.split(','));
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function parseQ(value: string | string[] | undefined | null): string | undefined {
  const q = firstParam(value)?.trim();
  if (!q) return undefined;
  return q.slice(0, MAX_QUERY_LENGTH);
}

export function parseSort(value: string | string[] | undefined | null): SortKey {
  const s = firstParam(value);
  return isSortKey(s) ? s : DEFAULT_SORT;
}

export function parseCategory(value: string | string[] | undefined | null): CategoryId | undefined {
  const c = firstParam(value);
  return isCategoryId(c) ? c : undefined;
}

export function parseA2A(value: string | string[] | undefined | null): boolean {
  const v = firstParam(value);
  return v === '1' || v === 'true';
}

export function parseBadges(value: string | string[] | undefined | null): BadgeId[] {
  return parseList(value).filter(isBadgeId);
}

export function parseProtocols(value: string | string[] | undefined | null): Protocol[] {
  return parseList(value).filter(isProtocol);
}

/** Returns a SLA floor strictly above the slider minimum, or undefined (no filter). */
export function parseMinSla(value: string | string[] | undefined | null): number | undefined {
  const raw = firstParam(value);
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  const clamped = clamp(Math.round(n / SLA_STEP) * SLA_STEP, SLA_FLOOR, SLA_CEIL);
  return clamped > SLA_FLOOR ? clamped : undefined;
}

export function parseMarketplaceParams(raw: RawParams): MarketplaceParams {
  return {
    category: parseCategory(raw.category),
    q: parseQ(raw.q),
    sort: parseSort(raw.sort),
    a2aOnly: parseA2A(raw.a2a),
    badges: parseBadges(raw.badge),
    protocols: parseProtocols(raw.protocol),
    minSla: parseMinSla(raw.minSla),
  };
}

/** Adapts `URLSearchParams` / `ReadonlyURLSearchParams` to the raw shape the parser expects. */
export function rawFromSearchParams(sp: { getAll(name: string): string[] }): RawParams {
  const out: RawParams = {};
  for (const key of PARAM_KEYS) {
    const all = sp.getAll(key);
    if (all.length === 1) out[key] = all[0];
    else if (all.length > 1) out[key] = all;
  }
  return out;
}

export function toAgentQuery(p: MarketplaceParams): AgentQuery {
  return {
    q: p.q,
    category: p.category ?? 'all',
    badges: p.badges,
    protocols: p.protocols,
    a2aOnly: p.a2aOnly,
    minSla: p.minSla,
    sort: p.sort,
  };
}

/** Number of facets set inside the Filters panel (badges, protocols, SLA floor). */
export function countPanelFilters(p: Pick<MarketplaceParams, 'badges' | 'protocols' | 'minSla'>): number {
  return p.badges.length + p.protocols.length + (p.minSla !== undefined ? 1 : 0);
}

/** True when anything other than the sort order narrows the result set. */
export function hasActiveFilters(p: MarketplaceParams): boolean {
  return !!p.category || !!p.q || p.a2aOnly || countPanelFilters(p) > 0;
}

/* -------------------------------- facets -------------------------------- */

export interface FilterFacets {
  badges: Record<BadgeId, number>;
  protocols: Record<Protocol, number>;
}

/** Counts how many agents in `list` carry each badge / protocol. */
export function buildFacets(list: Agent[]): FilterFacets {
  const badges = Object.fromEntries(BADGE_ORDER.map((b) => [b, 0])) as Record<BadgeId, number>;
  const protocols = Object.fromEntries(ALL_PROTOCOLS.map((p) => [p, 0])) as Record<Protocol, number>;
  for (const agent of list) {
    for (const b of agent.badges) badges[b] = (badges[b] ?? 0) + 1;
    for (const p of agent.protocols) protocols[p] = (protocols[p] ?? 0) + 1;
  }
  return { badges, protocols };
}

export type CategoryCounts = Record<CategoryId | 'all', number>;
