import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AlertTriangle, Boxes, Coins, Radio } from '@/components/ui/icons';
import { getMarketStats, queryAgents } from '@/lib/agents/repository';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ActiveFilters } from '@/components/marketplace/active-filters';
import { AgentGrid } from '@/components/marketplace/agent-grid';
import { CategoryHero } from '@/components/marketplace/category-hero';
import { CategoryTabs } from '@/components/marketplace/category-tabs';
import { Pagination } from '@/components/marketplace/pagination';
import { ResultsHeader } from '@/components/marketplace/results-header';
import { SearchBar } from '@/components/marketplace/search-bar';
import { SortSelect } from '@/components/marketplace/sort-select';
import { X402Toggle } from '@/components/marketplace/x402-toggle';
import { ControlSkeleton, TabsSkeleton } from '@/components/marketplace/skeletons';
import {
  countClassified,
  PAGE_SIZE,
  pageStep,
  parseMarketplaceParams,
  resolveTotal,
  sortLabel,
  toAgentQuery,
  type RawParams,
} from '@/components/marketplace/marketplace-config';

export const metadata: Metadata = {
  title: 'Marketplace',
  description:
    'Browse ERC-8004 agents indexed live from BNB Smart Chain, ranked by onchain reputation. Identity, feedback and declared A2A / MCP / x402 endpoints straight from the registries - no self-reported performance.',
};

interface MarketplacePageProps {
  searchParams?: RawParams;
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const params = parseMarketplaceParams(searchParams ?? {});
  const step = pageStep(params.category);
  const category = params.category ? CATEGORY_MAP[params.category] : undefined;

  // One listing round trip plus the cached headline count - the two are
  // independent, so they run together rather than in sequence.
  const [page, stats] = await Promise.all([queryAgents(toAgentQuery(params)), getMarketStats()]);

  const indexLive = !page.degraded && !stats.degraded;

  // One total for the whole page, resolved once and handed to every surface
  // that prints one. `getMarketStats()` (cached 900s) and the listing call
  // (cached 300s) both report an index-wide count and drift apart by a few
  // registrations between cache windows, which read as two contradictory
  // headline numbers on one screen; `resolveTotal` picks exactly one and says
  // what it counts, so nothing downstream has to guess whether the number means
  // the index or the matches.
  const total = resolveTotal(params, page, stats);
  // The index-wide count for the header sentence and the tile. It is the same
  // value the results line quotes whenever nothing is narrowing the query, and
  // `null` rather than a remembered figure when neither source answered.
  const indexWide = stats.degraded
    ? total.basis === 'index' && total.known
      ? total.value
      : null
    : stats.indexedAgents;
  // The x402 tile counts the same thing the results line counts whenever the
  // x402 toggle is the only thing narrowing the query, and the two sources are
  // cached for different windows: without this the page printed "67,010" in the
  // tile and "of 67,008 matching" in the results line, two figures for one fact.
  // The listing answered this request, so it is the fresher of the two.
  const x402Wide =
    params.x402Only && !params.q && total.known && total.basis === 'matching'
      ? total.value
      : stats.degraded
        ? null
        : stats.x402Agents;
  const classified = countClassified(page.agents);

  const headerStats = [
    {
      label: 'Agents indexed (BSC)',
      value: indexWide === null ? 'Unavailable' : formatNumber(indexWide, { compact: false }),
      icon: Boxes,
      tone: 'text-bnb',
    },
    {
      label: 'Advertise x402',
      value: x402Wide === null ? 'Unavailable' : formatNumber(x402Wide, { compact: false }),
      icon: Coins,
      tone: 'text-violet-300',
    },
    {
      label: 'Index status',
      value: indexLive ? 'Live' : 'Unreachable',
      icon: indexLive ? Radio : AlertTriangle,
      tone: indexLive ? 'text-emerald-300' : 'text-amber-300',
    },
  ];

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
              {indexLive ? (
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
                  Live index
                </Badge>
              ) : (
                <Badge tone="rose" size="md" icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden />}>
                  Index unreachable
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              <span className="text-gradient-white">Agent Marketplace</span>
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-400 sm:text-lg">
              {indexWide === null ? (
                <>The ERC-8004 index did not answer, so no agent count is shown rather than a remembered one.</>
              ) : (
                <>
                  <span className="tabular font-semibold text-slate-100">
                    {formatNumber(indexWide, { compact: false })}
                  </span>{' '}
                  agents indexed on BSC. Bazar lists the top of that index {PAGE_SIZE} at a time, ranked by{' '}
                  <span className="font-medium text-slate-200">{sortLabel(params.sort).toLowerCase()}</span>.
                </>
              )}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Identity, reputation and declared endpoints come straight from the registries. They publish no ROI, no
              SLA and no pricing, so neither does Bazar.
            </p>
          </div>

          {/* Stacked below sm: at 375px a three-up grid truncates the labels to
              "ADVERT…" and "INDEX S…", leaving the values under nothing. */}
          <dl className="grid grid-cols-1 divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:min-w-[440px]">
            {headerStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="px-4 py-3.5 sm:px-5">
                  <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${stat.tone}`} aria-hidden />
                    <span className="min-w-0">{stat.label}</span>
                  </dt>
                  <dd className="tabular mt-1 text-lg font-semibold text-white sm:text-xl">{stat.value}</dd>
                </div>
              );
            })}
          </dl>
        </header>

        {/* Category tabs */}
        <div className="mt-8">
          <Suspense fallback={<TabsSkeleton />}>
            <CategoryTabs />
          </Suspense>
        </div>

        {category && !page.degraded && (
          <div className="mt-6">
            <CategoryHero category={category} agents={page.agents} />
          </div>
        )}

        <section aria-label="Agents" className="mt-6 min-w-0">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Suspense fallback={<ControlSkeleton className="flex-1" />}>
              <SearchBar className="flex-1" />
            </Suspense>
            <div className="flex flex-wrap items-center gap-2">
              <Suspense fallback={<ControlSkeleton className="w-44" />}>
                <SortSelect />
              </Suspense>
              <Suspense fallback={<ControlSkeleton className="w-44" />}>
                <X402Toggle />
              </Suspense>
            </div>
          </div>

          <Suspense fallback={null}>
            <ActiveFilters className="mt-4" />
          </Suspense>

          <div className="mt-4">
            <ResultsHeader
              count={page.agents.length}
              total={total}
              offset={page.offset}
              step={step}
              categoryName={category?.name}
              classified={classified}
              q={params.q}
              sort={params.sort}
              degraded={page.degraded}
            />
          </div>

          <div className="mt-4">
            <AgentGrid
              agents={page.agents}
              degraded={page.degraded}
              error={page.error}
              q={params.q}
              categoryName={category?.name}
            />
          </div>

          {!page.degraded && (
            <Pagination className="mt-8" params={params} total={total} step={step} count={page.agents.length} />
          )}
        </section>
      </main>
    </div>
  );
}
