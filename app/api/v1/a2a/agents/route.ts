import type { NextRequest } from 'next/server';
import type { BadgeId, CategoryId, Protocol } from '@/lib/types';
import { queryAgents, type SortKey } from '@/lib/data/agents';
import { isCategoryId } from '@/lib/data/categories';
import { toAgentSummary } from '@/lib/a2a/schema';
import { errorResponse, jsonResponse, preflight } from '@/lib/a2a/hire-service';

export const dynamic = 'force-dynamic';

const SORT_KEYS: readonly SortKey[] = ['reputation', 'roi7d', 'sla', 'hires', 'price', 'newest'];
const BADGE_IDS: readonly BadgeId[] = [
  'erc8004-verified',
  'validated',
  'pancakeswap-top-trader',
  'venus-risk-monitor',
  'a2a-ready',
  'mcp-enabled',
  'fractional',
  'top-rated',
];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseIntParam(raw: string | null, fallback: number, min: number, max: number): number | null {
  if (raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Math.min(max, Math.max(min, n));
}

/**
 * GET /api/v1/a2a/agents
 * Query: category, q, a2a=1, sort, limit, offset, badge, protocol, minSla
 */
export function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const issues: { path: string; message: string }[] = [];

  const categoryRaw = sp.get('category');
  if (categoryRaw && categoryRaw !== 'all' && !isCategoryId(categoryRaw)) {
    issues.push({ path: 'category', message: 'category must be one of monitoring, grid-trading, health-factor, yield.' });
  }
  const category: CategoryId | 'all' = categoryRaw && isCategoryId(categoryRaw) ? categoryRaw : 'all';

  const sortRaw = sp.get('sort');
  const sort = (sortRaw ?? 'reputation') as SortKey;
  if (!SORT_KEYS.includes(sort)) {
    issues.push({ path: 'sort', message: `sort must be one of ${SORT_KEYS.join(', ')}.` });
  }

  const badges = sp.getAll('badge').filter(Boolean) as BadgeId[];
  const badBadge = badges.find((b) => !BADGE_IDS.includes(b));
  if (badBadge) issues.push({ path: 'badge', message: `Unknown badge "${badBadge}".` });

  const protocols = sp.getAll('protocol').filter(Boolean) as Protocol[];

  const minSlaRaw = sp.get('minSla');
  let minSla: number | undefined;
  if (minSlaRaw) {
    const n = Number(minSlaRaw);
    if (!Number.isFinite(n) || n < 0 || n > 100) issues.push({ path: 'minSla', message: 'minSla must be a number between 0 and 100.' });
    else minSla = n;
  }

  const limit = parseIntParam(sp.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
  if (limit === null) issues.push({ path: 'limit', message: `limit must be an integer between 1 and ${MAX_LIMIT}.` });
  const offset = parseIntParam(sp.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER);
  if (offset === null) issues.push({ path: 'offset', message: 'offset must be a non-negative integer.' });

  if (issues.length || limit === null || offset === null) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid query parameters.', issues);
  }

  const a2aRaw = sp.get('a2a');
  const a2aOnly = a2aRaw === '1' || a2aRaw === 'true';

  const all = queryAgents({
    q: sp.get('q') ?? undefined,
    category,
    badges,
    protocols,
    a2aOnly,
    minSla,
    sort,
  });

  const page = all.slice(offset, offset + limit).map(toAgentSummary);

  return jsonResponse({ ok: true, data: page, total: all.length, limit, offset });
}

export function OPTIONS() {
  return preflight();
}
