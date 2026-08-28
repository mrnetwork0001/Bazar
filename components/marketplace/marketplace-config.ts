/**
 * Shared, server-safe marketplace configuration and URL param helpers.
 *
 * Imported by the server page (to parse `searchParams` and to build
 * pagination links) and by the client controls (to parse
 * `useSearchParams()`), so every surface agrees on how
 * `?category=&q=&sort=&x402=1&offset=` is interpreted.
 *
 * Only params with a real backing in the ERC-8004 index survive here. The
 * badge checklist, the protocol checklist and the minimum-SLA slider were
 * removed with the mock catalog: the registries publish identity and
 * reputation, not SLA scores, and the eight marketing badges never existed
 * onchain.
 */
import { Grid3x3, HeartPulse, Scale, TrendingUp, type AppIcon } from '@/components/ui/icons';
import type { Category, CategoryId, IndexedAgent } from '@/lib/types';
import type { AgentQuery, SortKey } from '@/lib/agents/repository';
import { isCategoryId } from '@/lib/data/categories';
import type { BadgeTone } from '@/components/ui/badge';
import { clamp } from '@/lib/utils';

export type { AgentQuery, SortKey };

/* ------------------------------- sorting -------------------------------- */

/**
 * Exactly the sort keys `lib/agents/repository.ts` pushes down to the index -
 * `SORT_KEYS` there is the source of truth and this list must stay equal to it.
 * Adding one here without a `SORT_MAP` entry there would 400 the public A2A
 * endpoint for a URL that works in the UI.
 */
export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string; hint: string }> = [
  { value: 'reputation', label: 'Reputation score', hint: 'Aggregate ERC-8004 reputation, 0-100' },
  { value: 'feedback', label: 'Most feedback', hint: 'Number of onchain feedback entries' },
  { value: 'newest', label: 'Newest registered', hint: 'Most recent Identity Registry mint' },
];

/*
 * "Most starred" is deliberately not offered, and no longer exists anywhere.
 *
 * The index accepts `sort_by=star_count` and then ignores it: verified
 * 2026-08-28, `sort_by=star_count&order=desc` returns byte-identical rows to
 * `sort_by=created_at&order=desc`, every one with `star_count: 0`, while
 * identities that really do hold stars never appear. The control did nothing
 * except drop the reader into the bulk-registered tail under a label that
 * claimed otherwise.
 *
 * The key is now gone from `SortKey` and from `ScanQuery['sortBy']` as well, so
 * no surface can name it and no client call can send it. A bookmarked
 * `?sort=stars` is not an error: `parseSort` does not recognise it and returns
 * the default, so the link still renders the top of the ranking.
 */

/**
 * Reputation is the only sane default: the index is a registration log of
 * several hundred thousand rows - it grows constantly, so no figure is written
 * down here - in which almost nothing outside the ranked head has ever received
 * a feedback entry.
 */
export const DEFAULT_SORT: SortKey = 'reputation';

/** Narrows an untrusted string against the options this UI actually renders. */
export function isSortKey(value: unknown): value is SortKey {
  return typeof value === 'string' && SORT_OPTIONS.some((o) => o.value === value);
}

export function sortLabel(sort: SortKey): string {
  return SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Reputation score';
}

/* ------------------------------ pagination ------------------------------ */

export const PAGE_SIZE = 24;

/**
 * How far `offset` advances between pages.
 *
 * Categories are classified locally (`lib/indexer/classify.ts`) because the
 * index carries no category field, so a category filter cannot be pushed down.
 * `lib/agents/repository.ts` compensates by requesting `min(limit * 4, 100)`
 * raw records and keeping the ones that classify into the selected category.
 * Stepping by the page size while a category is selected would therefore
 * re-request records the previous page already consumed; the step mirrors the
 * repository's fetch window instead.
 */
export const CATEGORY_PAGE_STEP = Math.min(PAGE_SIZE * 4, 100);

export function pageStep(category?: CategoryId): number {
  return category ? CATEGORY_PAGE_STEP : PAGE_SIZE;
}

/** Guards against a hand-edited `?offset=` walking the index forever. */
export const MAX_OFFSET = 100_000;

/* ------------------------------ categories ------------------------------ */

export const CATEGORY_ICONS: Record<Category['icon'], AppIcon> = {
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

/**
 * Neutral accent for an agent Bazar could not classify. Painting a coverage
 * bucket in that bucket's colour is the same claim as the chip, made quietly:
 * an unclassified card gets slate and a colourless hover instead.
 */
export const UNCLASSIFIED_HEX = '#94A3B8';
export const UNCLASSIFIED_GLOW = 'hover:border-white/25';

export const BNB_HEX = '#F0B90B';
/** Accent for the x402 machine-payment surfaces. */
export const X402_ACCENT_HEX = '#A78BFA';

/* ---------------------------- classification ----------------------------- */

/**
 * True when Bazar's classifier found no category term in the agent's own
 * registration text and a bucket was assigned by hash for balanced coverage
 * (`coverageCategory` in lib/indexer/classify.ts).
 *
 * ERC-8004 has no category field and the brief grades four specific categories,
 * so the coverage placement exists - but it is Bazar's arithmetic, not the
 * agent's claim, and every surface that renders a category has to say which of
 * the two it is showing.
 *
 * This reads the structural flag `IndexedAgent.categoryConfidence`. It used to
 * string-match the `categoryReason` prose, which silently reclassified every
 * agent on the shelf the first time that copy was reworded.
 */
export function isUnclassified(agent: Pick<IndexedAgent, 'categoryConfidence'>): boolean {
  return agent.categoryConfidence === 'unclassified';
}

/**
 * @deprecated Use `isUnclassified`. Kept so `app/agents/[id]/page.tsx` keeps
 * compiling across this rename; the name is wrong now that the classifier calls
 * the hash placement "coverage" rather than "fallback".
 */
export const isFallbackCategory = isUnclassified;

/** How many of a rendered page matched a real term in their registration text. */
export function countClassified(agents: ReadonlyArray<Pick<IndexedAgent, 'categoryConfidence'>>): number {
  return agents.reduce((n, agent) => (isUnclassified(agent) ? n : n + 1), 0);
}

/* ------------------------------- protocols ------------------------------- */

/**
 * Tone for a protocol string as published in `IndexedAgent.protocols`.
 * The index returns free-form strings ("A2A", "MCP", "Web"), so anything
 * unrecognised falls back to the neutral slate chip rather than being hidden.
 */
export function protocolTone(protocol: string): BadgeTone {
  switch (protocol.trim().toUpperCase()) {
    case 'A2A':
      return 'violet';
    case 'MCP':
      return 'cyan';
    case 'WEB':
    case 'HTTP':
    case 'HTTPS':
      return 'sky';
    default:
      return 'slate';
  }
}

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

export const PARAM_KEYS = ['category', 'q', 'sort', 'x402', 'offset'] as const;
export type ParamKey = (typeof PARAM_KEYS)[number];

export type RawParams = Record<string, string | string[] | undefined>;

export interface MarketplaceParams {
  category?: CategoryId;
  q?: string;
  sort: SortKey;
  /** Only agents that advertise x402 machine payments (a real index filter). */
  x402Only: boolean;
  offset: number;
}

const MAX_QUERY_LENGTH = 80;

function firstParam(value: string | string[] | undefined | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export function parseQ(value: string | string[] | undefined | null): string | undefined {
  const q = firstParam(value)?.trim();
  if (!q) return undefined;
  return q.slice(0, MAX_QUERY_LENGTH);
}

/**
 * Falls back to reputation, so a stale link - `?sort=roi7d` from the mock
 * catalog, `?sort=stars` from the sort the index silently ignored - still
 * renders the top of the ranking instead of erroring.
 */
export function parseSort(value: string | string[] | undefined | null): SortKey {
  const s = firstParam(value);
  return isSortKey(s) ? s : DEFAULT_SORT;
}

export function parseCategory(value: string | string[] | undefined | null): CategoryId | undefined {
  const c = firstParam(value);
  return isCategoryId(c) ? c : undefined;
}

export function parseX402(value: string | string[] | undefined | null): boolean {
  const v = firstParam(value);
  return v === '1' || v === 'true';
}

/** Snapped to a whole page so prev/next stay coherent with the fetch window. */
export function parseOffset(value: string | string[] | undefined | null, step: number): number {
  const raw = firstParam(value);
  if (raw === undefined || raw === '') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(clamp(n, 0, MAX_OFFSET) / step) * step;
}

export function parseMarketplaceParams(raw: RawParams): MarketplaceParams {
  const category = parseCategory(raw.category);
  return {
    category,
    q: parseQ(raw.q),
    sort: parseSort(raw.sort),
    x402Only: parseX402(raw.x402),
    offset: parseOffset(raw.offset, pageStep(category)),
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

/** Serialises params back to a query string, omitting every default. */
export function marketplaceSearch(p: MarketplaceParams): string {
  const sp = new URLSearchParams();
  if (p.category) sp.set('category', p.category);
  if (p.q) sp.set('q', p.q);
  if (p.sort !== DEFAULT_SORT) sp.set('sort', p.sort);
  if (p.x402Only) sp.set('x402', '1');
  if (p.offset > 0) sp.set('offset', String(p.offset));
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/** Server-safe link builder (pagination links live outside any Suspense boundary). */
export function marketplaceHref(p: MarketplaceParams, overrides: Partial<MarketplaceParams> = {}): string {
  return `/marketplace${marketplaceSearch({ ...p, ...overrides })}`;
}

/** True when anything other than the sort order narrows the result set. */
export function hasActiveFilters(p: MarketplaceParams): boolean {
  return !!p.category || !!p.q || p.x402Only;
}

/* -------------------------------- totals --------------------------------- */

/**
 * What a quoted total actually counts.
 *
 * `index` - every agent the ERC-8004 index holds for this chain.
 * `matching` - rows matching the index-side filters (`q`, `x402`) of this query.
 *
 * There is deliberately no `category` basis. Categories are classified locally
 * over the fetched window, so no per-category total exists anywhere; a surface
 * showing a category must never present either number as one.
 */
export type TotalBasis = 'index' | 'matching';

export interface QuotedTotal {
  value: number;
  basis: TotalBasis;
  /** False when neither source answered, so the page quotes no total at all. */
  known: boolean;
}

/**
 * The page's single total, resolved once and handed to every surface that
 * prints one.
 *
 * Two counts reach this page: `getMarketStats()` (cached 900s) and the listing
 * response (cached 300s). Both are index-wide when nothing is filtered, and
 * they drift apart by a few registrations between cache windows, which reads as
 * two contradictory headline numbers on one screen. So exactly one of them is
 * ever printed:
 *
 * - a search or the x402 toggle narrows the set upstream, so the listing's own
 *   total is the only correct one and it counts matches, not the index;
 * - otherwise the cached index-wide count is used everywhere on the page, which
 *   is also the number the header tile shows.
 *
 * A category selection changes nothing here: it never converts either number
 * into a count of that category.
 */
export function resolveTotal(
  params: Pick<MarketplaceParams, 'q' | 'x402Only'>,
  page: { total: number; degraded: boolean },
  stats: { indexedAgents: number; degraded: boolean },
): QuotedTotal {
  const narrowed = Boolean(params.q) || params.x402Only;
  if (narrowed) {
    return { value: page.total, basis: 'matching', known: !page.degraded };
  }
  if (!stats.degraded) {
    return { value: stats.indexedAgents, basis: 'index', known: true };
  }
  return { value: page.total, basis: 'index', known: !page.degraded };
}

/** Maps parsed URL state onto the repository query. */
export function toAgentQuery(p: MarketplaceParams): AgentQuery {
  return {
    category: p.category ?? 'all',
    search: p.q,
    // `verifiedOnly` is deliberately never sent: `is_verified` is false for
    // every sampled BSC agent, so the filter can only ever return nothing.
    x402Only: p.x402Only || undefined,
    sort: p.sort,
    limit: PAGE_SIZE,
    offset: p.offset,
  };
}
