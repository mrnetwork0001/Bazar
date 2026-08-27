import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Coins,
  Gauge,
  HeartPulse,
  Percent,
  ShieldCheck,
  Signal,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { Agent } from '@/lib/types';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { Sparkline } from '@/components/ui/sparkline';
import { cn, formatNumber, formatPct, formatUsd } from '@/lib/utils';

/* --------------------------------- tiles -------------------------------- */

type Tone = 'up' | 'down' | 'neutral';

interface Tile {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: Tone;
}

const TONE_CLASS: Record<Tone, string> = {
  up: 'text-emerald-300',
  down: 'text-rose-300',
  neutral: 'text-white',
};

/** Label for the category's "did it work" rate. */
function successLabel(agent: Agent): { label: string; hint: string } {
  switch (agent.category) {
    case 'health-factor':
      return { label: 'Liquidation prevention', hint: 'Positions kept above the liquidation threshold.' };
    case 'monitoring':
      return { label: 'Alert accuracy', hint: 'Alerts confirmed against on-chain state, minus false positives.' };
    case 'yield':
      return { label: 'Positive epochs', hint: 'Rebalance epochs that finished net-positive after gas.' };
    case 'grid-trading':
    default:
      return { label: 'Win rate', hint: 'Share of closed grid cycles that realised a profit.' };
  }
}

/**
 * Six supporting tiles, chosen for the agent's economics.
 *
 * Monitoring and health-factor guardians report no PnL (`roi30d === 0`), so the
 * ROI / drawdown tiles would read as a flat "0.00%" and imply a dead agent.
 * Those agents get latency, uptime, hires and TVL-guarded instead.
 */
function supportingTiles(agent: Agent): Tile[] {
  const m = agent.metrics;
  const success = successLabel(agent);
  const hasPnl = m.roi30d !== 0;

  if (!hasPnl) {
    const candidates: Tile[] = [
      {
        key: 'latency',
        label: 'Avg response',
        value: `${formatNumber(m.avgResponseMs, { compact: false })} ms`,
        hint: 'Median time from block inclusion to delivered action.',
        icon: Timer,
      },
      {
        key: 'uptime',
        label: 'Uptime',
        value: formatPct(m.uptime, { sign: false }),
        hint: 'Share of the last 30 days the agent answered its heartbeat.',
        icon: Signal,
        tone: 'up',
      },
      {
        key: 'success',
        label: success.label,
        value: formatPct(m.winRate, { sign: false, decimals: 1 }),
        hint: success.hint,
        icon: agent.category === 'health-factor' ? HeartPulse : Target,
        tone: 'up',
      },
      {
        key: 'sla',
        label: 'SLA score',
        value: m.slaScore.toFixed(1),
        hint: 'Escrow SLA terms met, out of 100. Drives auto-release.',
        icon: Gauge,
      },
      {
        key: 'hires',
        label: 'Total hires',
        value: formatNumber(m.totalHires, { compact: false }),
        hint: 'Escrows settled since the agent was registered.',
        icon: Users,
      },
      {
        key: 'tvl',
        label: 'TVL guarded',
        value: formatUsd(m.tvlManaged),
        hint: 'Collateral currently under this agent’s watch.',
        icon: ShieldCheck,
      },
      {
        key: 'validations',
        label: 'Validations',
        value: formatNumber(agent.reputation.validations, { compact: false }),
        hint: 'Independent checks recorded in the Validation Registry.',
        icon: ShieldCheck,
      },
    ];
    return candidates.filter((t) => !(t.key === 'tvl' && m.tvlManaged === 0)).slice(0, 6);
  }

  return [
    {
      key: 'roi7d',
      label: 'ROI 7d',
      value: formatPct(m.roi7d),
      hint: 'Realised return over the last 7 days, net of gas.',
      icon: TrendingUp,
      tone: m.roi7d >= 0 ? 'up' : 'down',
    },
    {
      key: 'roi30d',
      label: 'ROI 30d',
      value: formatPct(m.roi30d),
      hint: 'Realised return over the last 30 days, net of gas.',
      icon: Percent,
      tone: m.roi30d >= 0 ? 'up' : 'down',
    },
    {
      key: 'dd',
      label: 'Max drawdown',
      value: formatPct(-m.maxDrawdown, { decimals: 2 }),
      hint: 'Deepest peak-to-trough loss on the 30-day curve.',
      icon: TrendingDown,
      tone: m.maxDrawdown > 0 ? 'down' : 'neutral',
    },
    {
      key: 'success',
      label: success.label,
      value: formatPct(m.winRate, { sign: false, decimals: 1 }),
      hint: success.hint,
      icon: Target,
      tone: 'up',
    },
    {
      key: 'tvl',
      label: 'TVL managed',
      value: formatUsd(m.tvlManaged),
      hint: 'Capital currently routed by this agent.',
      icon: Wallet,
    },
    {
      key: 'volume',
      label: 'Volume 7d',
      value: formatUsd(m.volume7d),
      hint: 'Notional executed on-chain over the last 7 days.',
      icon: Coins,
    },
  ];
}

/* --------------------------------- grid --------------------------------- */

export interface MetricsGridProps {
  agent: Agent;
  className?: string;
}

/**
 * Headline metric + six supporting stat tiles. Server-safe.
 */
export function MetricsGrid({ agent, className }: MetricsGridProps) {
  const category = CATEGORY_MAP[agent.category];
  const tiles = supportingTiles(agent);
  const m = agent.metrics;

  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {/* Headline metric always leads. */}
      <div
        className="col-span-2 relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl"
        style={{ boxShadow: `inset 0 1px 0 0 ${category.accentHex}20` }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${category.accentHex}, transparent)` }}
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: category.accentHex }} aria-hidden />
              {m.headline.label}
            </div>
            <div className="tabular mt-2 text-3xl font-semibold leading-none tracking-tight text-white sm:text-4xl">
              {m.headline.value}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {category.keyMetric} · the metric this category is ranked on
            </p>
          </div>
          <Sparkline
            data={agent.sparkline}
            width={132}
            height={44}
            color={category.accentHex}
            auto={false}
            className="hidden shrink-0 sm:block"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" aria-hidden />
            <span className="tabular text-slate-300">{formatNumber(m.activeHires, { compact: false })}</span> active hires
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5" aria-hidden />
            SLA <span className="tabular text-slate-300">{m.slaScore.toFixed(1)}</span> / 100
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Signal className="h-3.5 w-3.5" aria-hidden />
            Uptime <span className="tabular text-slate-300">{formatPct(m.uptime, { sign: false })}</span>
          </span>
        </div>
      </div>

      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.key}
            title={tile.hint}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-xl transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.05]"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span className="truncate">{tile.label}</span>
            </div>
            <div className={cn('tabular mt-2 text-xl font-semibold tracking-tight sm:text-2xl', TONE_CLASS[tile.tone ?? 'neutral'])}>
              {tile.value}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{tile.hint}</p>
          </div>
        );
      })}
    </div>
  );
}
