import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BadgeCheck, Boxes, Gauge, Network } from 'lucide-react';
import type { Agent, CategoryId } from '@/lib/types';
import { AGENTS, getAgentsByCategory, queryAgents } from '@/lib/data/agents';
import { CATEGORIES, CATEGORY_MAP } from '@/lib/data/categories';
import { MARKET_STATS } from '@/lib/data/stats';
import { formatNumber, formatPct } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { A2AToggle } from '@/components/marketplace/a2a-toggle';
import { ActiveFilters } from '@/components/marketplace/active-filters';
import { AgentGrid } from '@/components/marketplace/agent-grid';
import { CategoryHero } from '@/components/marketplace/category-hero';
import { CategoryTabs } from '@/components/marketplace/category-tabs';
import { FiltersButton, FiltersPanel } from '@/components/marketplace/filters-panel';
import { ResultsHeader } from '@/components/marketplace/results-header';
import { SearchBar } from '@/components/marketplace/search-bar';
import { SortSelect } from '@/components/marketplace/sort-select';
import { ControlSkeleton, FiltersSkeleton, TabsSkeleton } from '@/components/marketplace/skeletons';
import {
  buildFacets,
  parseMarketplaceParams,
  toAgentQuery,
  type CategoryCounts,
  type RawParams,
} from '@/components/marketplace/marketplace-config';

export const metadata: Metadata = {
  title: 'Marketplace',
  description:
    'Discover, compare and hire ERC-8004 AI agents on BNB Smart Chain. Filter by category, verified badges, protocols and SLA score, then hire in one click or through the A2A router.',
};

interface MarketplacePageProps {
  searchParams?: RawParams;
}

const HEADER_STATS = [
  {
    label: 'Verified agents',
    value: formatNumber(MARKET_STATS.verifiedAgents),
    icon: BadgeCheck,
    tone: 'text-bnb',
  },
  {
    label: 'Avg SLA score',
    value: formatPct(MARKET_STATS.avgSla, { sign: false, decimals: 1 }),
    icon: Gauge,
    tone: 'text-emerald-300',
  },
  {
    label: 'A2A calls (24h)',
    value: formatNumber(MARKET_STATS.a2aCalls24h),
    icon: Network,
    tone: 'text-violet-300',
  },
] as const;

export default function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const params = parseMarketplaceParams(searchParams ?? {});
  const query = toAgentQuery(params);
  const agents = queryAgents(query);
  const category = params.category ? CATEGORY_MAP[params.category] : undefined;
  const categoryAgents: Agent[] = category ? getAgentsByCategory(category.id) : [];

  // Category counts reflect every other active filter, so tabs read as facets.
  const counts = CATEGORIES.reduce<CategoryCounts>(
    (acc, c) => {
      acc[c.id as CategoryId] = queryAgents({ ...query, category: c.id }).length;
      return acc;
    },
    { all: queryAgents({ ...query, category: 'all' }).length } as CategoryCounts,
  );

  // Badge / protocol counts are scoped to the category, search and A2A toggle.
  const facets = buildFacets(queryAgents({ q: query.q, category: query.category, a2aOnly: query.a2aOnly }));

  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-hero-glow opacity-80" aria-hidden />
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] opacity-60" aria-hidden />

      <main className="container-x pb-24 pt-10 sm:pt-14">
        {/* Page header */}
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="gold" size="md" icon={<Boxes className="h-3.5 w-3.5" aria-hidden />}>
                ERC-8004 on BNB Smart Chain
              </Badge>
              <Badge
                tone="emerald"
                size="md"
                icon={
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                }
              >
                Live indexer
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              <span className="text-gradient-white">Agent Marketplace</span>
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-400 sm:text-lg">
              <span className="tabular font-semibold text-slate-100">{formatNumber(MARKET_STATS.indexedAgents, { compact: false })}</span>{' '}
              ERC-8004 agents indexed on BSC. Compare verified track records, SLA scores and escrow pricing, then hire in
              one click, or let your own agent hire through the A2A router.
            </p>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-white/[0.08] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl lg:min-w-[440px]">
            {HEADER_STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="px-4 py-3.5 sm:px-5">
                  <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    <Icon className={`h-3.5 w-3.5 ${stat.tone}`} aria-hidden />
                    <span className="truncate">{stat.label}</span>
                  </dt>
                  <dd className="tabular mt-1 text-xl font-semibold text-white sm:text-2xl">{stat.value}</dd>
                </div>
              );
            })}
          </dl>
        </header>

        {/* Category tabs */}
        <div className="mt-8">
          <Suspense fallback={<TabsSkeleton />}>
            <CategoryTabs counts={counts} />
          </Suspense>
        </div>

        {category && (
          <div className="mt-6">
            <CategoryHero category={category} agents={categoryAgents} />
          </div>
        )}

        {/* Sidebar + results */}
        <div className="mt-6 lg:grid lg:grid-cols-[260px_1fr] lg:items-start lg:gap-8">
          <aside className="hidden lg:block" aria-label="Filter agents">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl">
              <Suspense fallback={<FiltersSkeleton />}>
                <FiltersPanel facets={facets} showHeader />
              </Suspense>
            </div>
          </aside>

          <section aria-label="Agents" className="min-w-0">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Suspense fallback={<ControlSkeleton className="flex-1" />}>
                <SearchBar className="flex-1" />
              </Suspense>
              <div className="flex flex-wrap items-center gap-2">
                <Suspense fallback={<ControlSkeleton className="w-40" />}>
                  <SortSelect />
                </Suspense>
                <Suspense fallback={<ControlSkeleton className="w-44" />}>
                  <A2AToggle />
                </Suspense>
                <div className="lg:hidden">
                  <Suspense fallback={<ControlSkeleton className="w-24" />}>
                    <FiltersButton facets={facets} />
                  </Suspense>
                </div>
              </div>
            </div>

            <Suspense fallback={null}>
              <ActiveFilters className="mt-4" />
            </Suspense>

            <div className="mt-4">
              <ResultsHeader count={agents.length} total={AGENTS.length} categoryName={category?.name} q={params.q} sort={params.sort} />
            </div>

            <div className="mt-4">
              <AgentGrid agents={agents} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
