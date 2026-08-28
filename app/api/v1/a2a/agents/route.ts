import type { NextRequest } from 'next/server';
import type { CategoryId } from '@/lib/types';
import { queryAgents, type SortKey } from '@/lib/agents/repository';
import { CATEGORIES, isCategoryId } from '@/lib/data/categories';
import { buildAgentsResponse } from '@/lib/a2a/schema';
import { errorResponse, indexUnavailable, jsonResponse, preflight } from '@/lib/a2a/hire-service';
import { BSC_MAINNET, BSC_TESTNET, DEFAULT_CHAIN_ID, type SupportedChainId } from '@/lib/chain/addresses';

export const dynamic = 'force-dynamic';

/**
 * The sort keys the repository implements *and* the index honours - the same
 * set the marketplace SortSelect offers, so a URL that works in the storefront
 * cannot 400 here.
 *
 * `stars` is absent on purpose: the index accepts `sort_by=star_count` and then
 * ignores it, returning registration order with `star_count: 0` on every row.
 * Advertising a sort that silently does something else is worse than not
 * offering it.
 */
const SORT_KEYS: readonly SortKey[] = ['reputation', 'feedback', 'newest'];
const CATEGORY_IDS = CATEGORIES.map((c) => c.id).join(', ');
const CHAIN_IDS: readonly SupportedChainId[] = [BSC_MAINNET, BSC_TESTNET];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseIntParam(raw: string | null, fallback: number, min: number, max: number): number | null {
  if (raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) return null;
  return Math.min(max, Math.max(min, Number(raw)));
}

function parseBool(raw: string | null): boolean {
  return raw === '1' || raw === 'true';
}

/**
 * GET /api/v1/a2a/agents
 *
 * Query: category, search (alias: q), sort, x402, limit, offset, chainId.
 *
 * Reads the same `queryAgents` repository the storefront reads, so the machine
 * layer and the human layer can never disagree about what is listed. Every
 * field on a returned agent traces to the ERC-8004 registries or the public
 * index - there is no price, ROI, SLA score, uptime or hire count to filter on,
 * because none of those are published on chain.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const issues: { path: string; message: string }[] = [];

  const categoryRaw = sp.get('category');
  if (categoryRaw && categoryRaw !== 'all' && !isCategoryId(categoryRaw)) {
    issues.push({ path: 'category', message: `category must be "all" or one of ${CATEGORY_IDS}.` });
  }
  const category: CategoryId | 'all' = categoryRaw && isCategoryId(categoryRaw) ? categoryRaw : 'all';

  const sortRaw = sp.get('sort');
  const sort = (sortRaw ?? 'reputation') as SortKey;
  if (!SORT_KEYS.includes(sort)) {
    issues.push({ path: 'sort', message: `sort must be one of ${SORT_KEYS.join(', ')}.` });
  }

  const chainRaw = sp.get('chainId');
  let chainId: SupportedChainId = DEFAULT_CHAIN_ID;
  if (chainRaw) {
    const n = Number(chainRaw);
    if (!CHAIN_IDS.includes(n as SupportedChainId)) {
      issues.push({ path: 'chainId', message: `chainId must be ${BSC_MAINNET} or ${BSC_TESTNET}.` });
    } else {
      chainId = n as SupportedChainId;
    }
  }

  const limit = parseIntParam(sp.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
  if (limit === null) issues.push({ path: 'limit', message: `limit must be an integer between 1 and ${MAX_LIMIT}.` });
  const offset = parseIntParam(sp.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER);
  if (offset === null) issues.push({ path: 'offset', message: 'offset must be a non-negative integer.' });

  if (issues.length || limit === null || offset === null) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid query parameters.', issues);
  }

  const search = (sp.get('search') ?? sp.get('q') ?? '').trim();

  const page = await queryAgents({
    category,
    search: search || undefined,
    x402Only: parseBool(sp.get('x402')),
    sort,
    limit,
    offset,
    chainId,
  });

  // An empty `agents` array means two very different things. Never let a caller
  // read "the index is down" as "there are no matching agents".
  if (page.degraded) {
    const { status, body } = indexUnavailable(page.error);
    return jsonResponse(body, { status });
  }

  return jsonResponse(
    buildAgentsResponse(page.agents, {
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      category,
      search: search || null,
      sort,
      chainId,
    }),
  );
}

export function OPTIONS() {
  return preflight();
}
