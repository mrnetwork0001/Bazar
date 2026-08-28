import type { Agent, Category } from '@/lib/types';
import { formatNumber, formatPct, formatUsd } from '@/lib/utils';
import { CATEGORY_ICONS, withAlpha } from './marketplace-config';

export interface CategoryHeroProps {
  category: Category;
  /** All agents in this category (unfiltered) — used for the aggregate facts. */
  agents: Agent[];
}

function Fact({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink/40 px-4 py-3">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="tabular mt-1 text-sm font-semibold leading-snug text-white" style={accent ? { color: accent } : undefined}>
        {value}
      </dd>
    </div>
  );
}

/** Band shown under the tabs when a category is selected. Tinted with the category accent. Server-safe. */
export function CategoryHero({ category, agents }: CategoryHeroProps) {
  const Icon = CATEGORY_ICONS[category.icon];
  const hex = category.accentHex;
  const totalHires = agents.reduce((sum, a) => sum + a.metrics.totalHires, 0);
  const avgSla = agents.length ? agents.reduce((sum, a) => sum + a.metrics.slaScore, 0) / agents.length : 0;
  const tvl = agents.reduce((sum, a) => sum + a.metrics.tvlManaged, 0);

  return (
    <section
      aria-labelledby={`category-hero-${category.id}`}
      className="relative overflow-hidden rounded-2xl border p-6 sm:p-7"
      style={{
        borderColor: withAlpha(hex, 0.28),
        background: `radial-gradient(90% 140% at 0% 0%, ${withAlpha(hex, 0.16)} 0%, rgba(255,255,255,0.02) 55%, rgba(255,255,255,0.01) 100%)`,
      }}
    >
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
            style={{ background: withAlpha(hex, 0.12), borderColor: withAlpha(hex, 0.35), color: hex }}
          >
            <Icon className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: hex }}>
              {category.agentType}
            </div>
            <h2 id={`category-hero-${category.id}`} className="mt-0.5 text-2xl font-semibold tracking-tight text-white">
              {category.name}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-400">{category.description}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:w-auto lg:min-w-[440px]">
          <Fact label="Primary on-chain action" value={category.primaryAction} />
          <Fact label="Key metric" value={category.keyMetric} accent={hex} />
          <Fact label="Agents listed" value={formatNumber(agents.length, { compact: false })} />
          <Fact label="Hires completed" value={formatNumber(totalHires)} />
          <Fact label="Avg SLA score" value={formatPct(avgSla, { sign: false, decimals: 1 })} />
          <Fact label={category.id === 'rebalancing' ? 'Category share' : 'TVL under management'} value={tvl > 0 ? formatUsd(tvl) : 'Alerts only'} />
        </dl>
      </div>
    </section>
  );
}
