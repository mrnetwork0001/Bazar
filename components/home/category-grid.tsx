import Link from 'next/link';
import { ArrowUpRight, Grid3x3, HeartPulse, Scale, TrendingUp, type AppIcon } from '@/components/ui/icons';
import type { CategoryCounts } from '@/components/home/home-data';
import { Reveal } from '@/components/home/reveal';
import { SectionHeading } from '@/components/home/section-heading';
import { CATEGORIES } from '@/lib/data/categories';
import type { Category } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICONS: Record<Category['icon'], AppIcon> = { Scale, Grid3x3, HeartPulse, TrendingUp };

/** Static class strings per accent so Tailwind can see them at build time. */
const ACCENT: Record<Category['accent'], { text: string; hover: string; tile: string }> = {
  rebalancing: {
    text: 'text-cat-rebalancing',
    hover: 'hover:border-cat-rebalancing/50 hover:shadow-glow-cyan',
    tile: 'bg-cat-rebalancing/10',
  },
  grid: { text: 'text-cat-grid', hover: 'hover:border-cat-grid/50 hover:shadow-glow', tile: 'bg-cat-grid/10' },
  health: {
    text: 'text-cat-health',
    hover: 'hover:border-cat-health/50 hover:shadow-glow-emerald',
    tile: 'bg-cat-health/10',
  },
  yield: { text: 'text-cat-yield', hover: 'hover:border-cat-yield/50 hover:shadow-glow-violet', tile: 'bg-cat-yield/10' },
};

export interface CategoryGridProps {
  /**
   * Tallies within the ranked sample only - never an index-wide total, and
   * never including agents Bazar could not classify from their own text.
   */
  counts: CategoryCounts;
  /** Ranked agents in the sample that matched no category rule. */
  unclassified: number;
  /** How many ranked agents those tallies cover. */
  sampleSize: number;
  degraded: boolean;
}

export function CategoryGrid({ counts, unclassified, sampleSize, degraded }: CategoryGridProps) {
  const showCounts = !degraded && sampleSize > 0;

  return (
    <section id="categories" className="container-x py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="BNB Agent Studio domains"
          title="Four categories, derived from what agents publish."
          description="The Identity Registry has no category field - an agent is a name, a description and a set of endpoints. Bazar classifies from the agent's own registration text and names the matched term on every agent page. Where nothing matched, the listing is marked Unclassified and is counted in none of the four figures below."
          action={{ href: '/marketplace', label: 'Open marketplace' }}
        />
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CATEGORIES.map((cat, i) => {
          const Icon = ICONS[cat.icon];
          const accent = ACCENT[cat.accent];
          const count = counts[cat.id];
          return (
            <Reveal key={cat.id} delay={i * 0.06} className="h-full">
              <Link
                href={`/marketplace?category=${cat.id}`}
                className={cn(
                  'glass group relative flex h-full flex-col overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.06] ring-focus',
                  accent.hover,
                )}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: `radial-gradient(160px 110px at 18% 0%, ${cat.accentHex}26, transparent 70%)` }}
                />

                <div className="relative flex items-start justify-between">
                  <span
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ring-white/10',
                      accent.tile,
                    )}
                    style={{ color: cat.accentHex }}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <ArrowUpRight
                    className="h-4 w-4 text-slate-500 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
                    aria-hidden
                  />
                </div>

                <h3 className="relative mt-5 text-lg font-semibold text-white">{cat.name}</h3>
                <p className="relative mt-1 text-sm text-slate-400">{cat.tagline}</p>

                <dl className="relative mt-5 space-y-2 border-t border-white/[0.08] pt-4 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Agent type</dt>
                    <dd className="text-right text-slate-300">{cat.agentType}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Ranked by</dt>
                    <dd className={cn('text-right font-medium', accent.text)}>Reputation score</dd>
                  </div>
                </dl>

                <p className="relative mt-auto pt-4 font-mono text-[11px] leading-relaxed text-slate-500">
                  {showCounts ? (
                    <>
                      <span className="tabular text-slate-200">{count}</span> of the top {sampleSize} ranked agents
                      matched this from their own text
                    </>
                  ) : (
                    <>Category share unavailable</>
                  )}
                </p>
              </Link>
            </Reveal>
          );
        })}
      </div>

      <Reveal className="mt-4" delay={0.24}>
        <p className="text-xs leading-relaxed text-slate-500">
          {showCounts ? (
            <>
              Counts cover the top {sampleSize} agents by onchain reputation, not the whole index: classification runs
              on the agent text Bazar has fetched, so an index-wide per-category total does not exist and is not shown.{' '}
              {unclassified > 0 ? (
                <>
                  <span className="tabular text-slate-400">{unclassified}</span> of those {sampleSize} published nothing
                  a category rule matched. They are listed as Unclassified and counted in none of the four tiles - Bazar
                  places them on a shelf so they stay browsable, and says so rather than passing the placement off as
                  the agent&apos;s own claim.
                </>
              ) : (
                <>Every agent in this sample matched a category rule in its own registration text.</>
              )}
            </>
          ) : (
            <>
              The ERC-8004 index is not answering, so no category tallies are shown. Bazar leaves the number out rather
              than estimating it.
            </>
          )}
        </p>
      </Reveal>
    </section>
  );
}
