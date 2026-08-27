import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, BadgeCheck, Gauge } from 'lucide-react';
import type { Agent } from '@/lib/types';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { AgentBadge, Badge, type BadgeTone } from '@/components/ui/badge';
import { Sparkline } from '@/components/ui/sparkline';
import { cn, formatNumber, formatPct, formatToken, formatUsd, periodLabel } from '@/lib/utils';
import { CATEGORY_GLOW, CATEGORY_ICONS, CATEGORY_TONE } from './marketplace-config';

/* -------------------------------- helpers -------------------------------- */

interface MiniStat {
  label: string;
  value: string;
  tone?: 'up' | 'down' | 'neutral';
}

/** Three category-appropriate stats shown under the headline metric. */
function miniStats(agent: Agent): MiniStat[] {
  const m = agent.metrics;
  switch (agent.category) {
    case 'grid-trading':
      return [
        { label: 'ROI 7d', value: formatPct(m.roi7d), tone: m.roi7d >= 0 ? 'up' : 'down' },
        { label: 'Max DD', value: formatPct(-m.maxDrawdown, { decimals: 1 }), tone: m.maxDrawdown > 0 ? 'down' : 'neutral' },
        { label: 'Win rate', value: formatPct(m.winRate, { sign: false, decimals: 1 }) },
      ];
    case 'monitoring':
      return [
        { label: 'Latency', value: `${m.avgResponseMs} ms` },
        { label: 'Uptime', value: formatPct(m.uptime, { sign: false }) },
        { label: 'Hires', value: formatNumber(m.totalHires) },
      ];
    case 'health-factor':
      return [
        { label: 'Prevention', value: formatPct(m.winRate, { sign: false, decimals: 1 }), tone: 'up' },
        { label: 'Uptime', value: formatPct(m.uptime, { sign: false }) },
        { label: 'TVL guarded', value: formatUsd(m.tvlManaged) },
      ];
    case 'yield':
      return [
        { label: 'ROI 30d', value: formatPct(m.roi30d), tone: m.roi30d >= 0 ? 'up' : 'down' },
        { label: 'TVL managed', value: formatUsd(m.tvlManaged) },
        { label: 'Max DD', value: formatPct(-m.maxDrawdown, { decimals: 1 }), tone: m.maxDrawdown > 0 ? 'down' : 'neutral' },
      ];
    default:
      return [];
  }
}

const STAT_TONE: Record<NonNullable<MiniStat['tone']>, string> = {
  up: 'text-emerald-300',
  down: 'text-rose-300',
  neutral: 'text-slate-200',
};

function slaTone(score: number): BadgeTone {
  if (score >= 98) return 'emerald';
  if (score >= 95) return 'gold';
  return 'slate';
}

function weeklyTier(agent: Agent) {
  return agent.pricing.find((t) => t.id === 'weekly') ?? agent.pricing[0];
}

function Avatar({ agent, size }: { agent: Agent; size: 'sm' | 'lg' }) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-br font-bold tracking-wide text-white ring-1 ring-inset ring-white/20',
        agent.avatar.gradient,
        size === 'lg' ? 'h-12 w-12 text-sm' : 'h-10 w-10 text-xs',
      )}
    >
      {agent.avatar.initials}
    </div>
  );
}

/* --------------------------------- card ---------------------------------- */

export interface AgentCardProps {
  agent: Agent;
  /** Smaller horizontal variant for landing / detail pages. */
  compact?: boolean;
  /** Position in a list; drives a short CSS stagger (content stays visible without JS). */
  index?: number;
}

/**
 * Marketplace agent card. Server-safe: no hooks, no client-only APIs.
 * The whole card is a single link to `/agents/[id]`; nothing inside is interactive.
 */
export function AgentCard({ agent, compact, index }: AgentCardProps) {
  const category = CATEGORY_MAP[agent.category];
  const CategoryIcon = CATEGORY_ICONS[category.icon];
  const href = `/agents/${agent.id}`;
  const staggerStyle: CSSProperties | undefined =
    index !== undefined ? { animationDelay: `${Math.min(index, 12) * 45}ms` } : undefined;
  const tier = weeklyTier(agent);

  if (compact) {
    return (
      <Link
        href={href}
        aria-label={`${agent.name} — ${category.name} agent`}
        style={staggerStyle}
        className={cn(
          'group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 backdrop-blur-xl',
          'shadow-card transition-all duration-300 hover:bg-white/[0.06] ring-focus',
          CATEGORY_GLOW[category.accent],
          index !== undefined && 'animate-fade-up',
        )}
      >
        <Avatar agent={agent} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-white">{agent.name}</span>
            {agent.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-bnb" aria-hidden />}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="font-medium" style={{ color: category.accentHex }}>
              {category.shortName}
            </span>
            <span aria-hidden>·</span>
            <span className="truncate">{agent.metrics.headline.label}</span>
          </div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="tabular text-sm font-semibold text-white">{agent.metrics.headline.value}</div>
          <div className="tabular text-[11px] text-slate-500">SLA {agent.metrics.slaScore.toFixed(1)}</div>
        </div>
        <Sparkline data={agent.sparkline} width={72} height={24} auto className="hidden shrink-0 xs:block sm:block" />
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition-all group-hover:translate-x-0.5 group-hover:text-bnb" aria-hidden />
      </Link>
    );
  }

  const stats = miniStats(agent);
  const visibleBadges = agent.badges.slice(0, 3);
  const extraBadges = agent.badges.length - visibleBadges.length;

  return (
    <Link
      href={href}
      aria-label={`View ${agent.name}, ${category.name} agent`}
      style={staggerStyle}
      className={cn(
        'group relative block h-full rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl',
        'shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06] ring-focus',
        CATEGORY_GLOW[category.accent],
        index !== undefined && 'animate-fade-up',
      )}
    >
      <article className="flex h-full flex-col p-5">
        {/* identity row */}
        <div className="flex items-start gap-3">
          <Avatar agent={agent} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[15px] font-semibold leading-tight text-white">{agent.name}</h3>
              {agent.verified && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-bnb" aria-label="ERC-8004 verified" role="img" />
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-xs text-slate-400">
              <span className="truncate">{agent.handle}</span>
              <span aria-hidden className="text-slate-600">·</span>
              <span className="tabular text-slate-500">#{agent.tokenId}</span>
            </div>
          </div>
          <Badge tone={CATEGORY_TONE[category.accent]} icon={<CategoryIcon className="h-3 w-3" aria-hidden />} className="shrink-0">
            {category.shortName}
          </Badge>
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-400">{agent.tagline}</p>

        {/* headline metric + sparkline */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: category.accentHex }} aria-hidden />
              {agent.metrics.headline.label}
            </div>
            <div className="tabular mt-0.5 text-2xl font-semibold leading-none tracking-tight text-white">
              {agent.metrics.headline.value}
            </div>
          </div>
          <Sparkline data={agent.sparkline} width={120} height={36} auto className="shrink-0" />
        </div>

        {/* mini stats */}
        <dl className="mt-4 grid grid-cols-3 divide-x divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02]">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0 px-3 py-2">
              <dt className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-500">{s.label}</dt>
              <dd className={cn('tabular mt-0.5 truncate text-sm font-semibold', STAT_TONE[s.tone ?? 'neutral'])}>{s.value}</dd>
            </div>
          ))}
        </dl>

        {/* badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visibleBadges.map((b) => (
            <AgentBadge key={b} badge={b} />
          ))}
          {extraBadges > 0 && (
            <Badge tone="slate" title={`${extraBadges} more badge${extraBadges === 1 ? '' : 's'}`}>
              +{extraBadges}
            </Badge>
          )}
        </div>

        {/* footer */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <div className="min-w-0">
            {tier ? (
              <div className="flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-[11px] text-slate-500">from</span>
                <span className="tabular text-sm font-semibold text-white">{formatToken(tier.price, tier.currency)}</span>
                <span className="text-xs text-slate-500">{periodLabel(tier.period)}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Custom pricing</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={slaTone(agent.metrics.slaScore)} icon={<Gauge className="h-3 w-3" aria-hidden />} title="SLA adherence score">
              <span className="tabular">SLA {agent.metrics.slaScore.toFixed(1)}</span>
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-bnb transition-transform duration-200 group-hover:translate-x-0.5">
              View agent
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
