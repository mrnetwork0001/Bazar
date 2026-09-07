import Link from 'next/link';
import { Grid3x3, HeartPulse, Scale, TrendingUp, type AppIcon } from '@/components/ui/icons';
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
   * Index-wide counts: agents whose own registration text files them under
   * each category, across the whole ERC-8004 index rather than a sample.
   */
  counts: CategoryCounts;
  degraded: boolean;
}

export function CategoryGrid({ counts, degraded }: CategoryGridProps) {
  const showCounts = !degraded;

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

                {/*
                  The count leads the card. It is the only thing on here that
                  is measured rather than declared, and it used to sit at the
                  bottom in 11px mono where it read as a footnote.
                */}
                <div className="relative flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-white/10',
                      accent.tile,
                    )}
                    style={{ color: cat.accentHex }}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-right">
                    <span className={cn('tabular block text-2xl font-semibold leading-none', accent.text)}>
                      {showCounts ? count : '--'}
                    </span>
                    <span className="mt-1 block text-[10px] uppercase tracking-wider text-slate-500">
                      {showCounts ? 'on BNB Chain' : 'unavailable'}
                    </span>
                  </span>
                </div>

                <h3 className="relative mt-5 text-lg font-semibold text-white">{cat.name}</h3>
                <p className="relative mt-1.5 text-sm leading-relaxed text-slate-400">{cat.tagline}</p>

                {/*
                  "Ranked by: Reputation score" was identical on all four cards,
                  so a table meant to differentiate them repeated the same row
                  four times. Only the agent type actually varies, so only it
                  remains.
                */}
                <p className="relative mt-auto border-t border-white/[0.08] pt-4 text-[11px] uppercase tracking-wider text-slate-500">
                  {cat.agentType}
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
              Counted across the whole ERC-8004 index on BNB Smart Chain, not a sample. Each figure is the number of
              agents whose own registration text names that category - the shelf is built by searching the index for
              those terms, so the number and the listing behind it are the same set. Agents that published no category
              signal are marked Unclassified and counted in none of the four.
            </>
          ) : (
            <>The ERC-8004 index is not answering, so no tallies are shown rather than estimated.</>
          )}
        </p>
      </Reveal>
    </section>
  );
}
