import type { Category, IndexedAgent } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { CATEGORY_ICONS, countClassified, withAlpha } from './marketplace-config';

export interface CategoryHeroProps {
  category: Category;
  /** The agents actually rendered on this page - the only set we can honestly aggregate. */
  agents: IndexedAgent[];
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

function hasProtocol(agent: IndexedAgent, protocol: string): boolean {
  return agent.protocols.some((p) => p.trim().toUpperCase() === protocol);
}

/**
 * Band shown under the tabs when a category is selected.
 *
 * Every figure is computed from the agents on this page. There is no
 * "agents in this category" total to quote: the index has no category field,
 * so Bazar classifies what it fetches (lib/indexer/classify.ts) and can only
 * describe the window it actually looked at. Server-safe.
 */
export function CategoryHero({ category, agents }: CategoryHeroProps) {
  const Icon = CATEGORY_ICONS[category.icon];
  const hex = category.accentHex;

  const n = agents.length;
  const avgScore = n ? agents.reduce((sum, a) => sum + a.reputation.totalScore, 0) / n : 0;
  const withFeedback = agents.filter((a) => a.reputation.totalFeedbacks > 0).length;
  const withA2A = agents.filter((a) => hasProtocol(a, 'A2A')).length;
  const withMcp = agents.filter((a) => hasProtocol(a, 'MCP')).length;
  const withX402 = agents.filter((a) => a.x402).length;
  // How many of these agents Bazar can point at a matched term for. The rest
  // matched nothing and were spread across the four buckets for coverage, which
  // the copy has to say out loud rather than implying every filing is derived
  // from the agent's own words.
  const matched = countClassified(agents);

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
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-400">
              Figures below describe the {formatNumber(n, { compact: false })} agent{n === 1 ? '' : 's'} on this page.
              ERC-8004 has no category field, so Bazar reads the text each agent registered onchain:{' '}
              <span className="font-medium text-slate-200">
                {formatNumber(matched, { compact: false })} of {formatNumber(n, { compact: false })}
              </span>{' '}
              matched a term for this category and carry the coloured chip. The remainder matched nothing, are marked{' '}
              <span className="font-medium text-slate-200">Unclassified</span>, and are shown here for coverage rather
              than because they claimed this category.
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:w-auto lg:min-w-[440px]">
          <Fact label="Primary onchain action" value={category.primaryAction} />
          <Fact label="On this page" value={formatNumber(n, { compact: false })} accent={hex} />
          <Fact
            label="Avg reputation"
            value={n ? `${avgScore.toFixed(1)} / 100` : 'No agents'}
          />
          <Fact label="With feedback" value={n ? `${withFeedback} of ${n}` : '0'} />
          <Fact label="Matched a category term" value={n ? `${matched} of ${n}` : '0'} />
          <Fact label="Declare A2A / MCP" value={`${withA2A} / ${withMcp}`} />
          <Fact label="x402 payments" value={formatNumber(withX402, { compact: false })} />
        </dl>
      </div>
    </section>
  );
}
