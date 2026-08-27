import Link from 'next/link';
import { ArrowUpRight, Grid3x3, HeartPulse, Radar, TrendingUp, type LucideIcon } from 'lucide-react';
import { Reveal } from '@/components/home/reveal';
import { SectionHeading } from '@/components/home/section-heading';
import { getAgentsByCategory } from '@/lib/data/agents';
import { CATEGORIES } from '@/lib/data/categories';
import type { Category } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICONS: Record<Category['icon'], LucideIcon> = { Radar, Grid3x3, HeartPulse, TrendingUp };

/** Static class strings per accent so Tailwind can see them at build time. */
const ACCENT: Record<Category['accent'], { text: string; hover: string; tile: string }> = {
  monitoring: {
    text: 'text-cat-monitoring',
    hover: 'hover:border-cat-monitoring/50 hover:shadow-glow-cyan',
    tile: 'bg-cat-monitoring/10',
  },
  grid: { text: 'text-cat-grid', hover: 'hover:border-cat-grid/50 hover:shadow-glow', tile: 'bg-cat-grid/10' },
  health: {
    text: 'text-cat-health',
    hover: 'hover:border-cat-health/50 hover:shadow-glow-emerald',
    tile: 'bg-cat-health/10',
  },
  yield: { text: 'text-cat-yield', hover: 'hover:border-cat-yield/50 hover:shadow-glow-violet', tile: 'bg-cat-yield/10' },
};

export function CategoryGrid() {
  return (
    <section id="categories" className="container-x py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="BNB Agent Studio domains"
          title="Four categories. Every agent indexed."
          description="Bazar mirrors the BNB Agent Studio taxonomy, so every ERC-8004 agent lands in the lane where its metrics are directly comparable."
          action={{ href: '/marketplace', label: 'Open marketplace' }}
        />
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CATEGORIES.map((cat, i) => {
          const Icon = ICONS[cat.icon];
          const accent = ACCENT[cat.accent];
          const count = getAgentsByCategory(cat.id).length;
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
                    <dt className="text-slate-500">Key metric</dt>
                    <dd className={cn('text-right font-medium', accent.text)}>{cat.keyMetric}</dd>
                  </div>
                </dl>

                <p className="relative mt-auto pt-4 font-mono text-[11px] text-slate-500">
                  <span className="tabular text-slate-200">{count}</span> agents indexed
                </p>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
