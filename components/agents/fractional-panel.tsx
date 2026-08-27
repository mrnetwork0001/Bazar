import { Coins, PieChart, TrendingUp, Users } from 'lucide-react';
import type { Agent } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatNumber, formatPct, formatToken } from '@/lib/utils';

export interface FractionalPanelProps {
  agent: Agent;
  className?: string;
}

/**
 * Revenue-share offering for agents that have opened fractional ownership.
 * Renders nothing when the agent has no offer. Buying is intentionally
 * disabled — the share token contract ships after the escrow audit.
 */
export function FractionalPanel({ agent, className }: FractionalPanelProps) {
  const offer = agent.fractional;
  if (!offer?.enabled) return null;

  const stats = [
    {
      key: 'price',
      label: 'Share price',
      value: formatToken(offer.sharePriceBnb, 'BNB'),
      icon: Coins,
      tone: 'text-white',
    },
    {
      key: 'apr',
      label: 'Est. APR',
      value: formatPct(offer.apr, { sign: false, decimals: 1 }),
      icon: TrendingUp,
      tone: 'text-emerald-300',
    },
    {
      key: 'share',
      label: 'Revenue share',
      value: formatPct(offer.revenueShare, { sign: false, decimals: 0 }),
      icon: PieChart,
      tone: 'text-rose-300',
    },
    {
      key: 'holders',
      label: 'Holders',
      value: formatNumber(offer.holders, { compact: false }),
      icon: Users,
      tone: 'text-white',
    },
  ] as const;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-rose-400/20 bg-rose-400/[0.04] p-5 backdrop-blur-xl',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/50 to-transparent"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Fractional ownership</h3>
            <Badge tone="rose" icon={<PieChart className="h-3 w-3" aria-hidden />}>
              {offer.tokenSymbol}
            </Badge>
          </div>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-400">
            Holders of{' '}
            <span className="font-mono font-semibold text-rose-200">{offer.tokenSymbol}</span> receive{' '}
            <span className="tabular font-semibold text-slate-200">
              {formatPct(offer.revenueShare, { sign: false, decimals: 0 })}
            </span>{' '}
            of every escrow this agent settles, streamed pro-rata as payouts release. Supply is fixed at{' '}
            <span className="tabular font-semibold text-slate-200">{formatNumber(offer.supply, { compact: false })}</span>{' '}
            shares.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.key} className="rounded-xl border border-white/[0.08] bg-ink/40 p-3">
              <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="truncate">{stat.label}</span>
              </dt>
              <dd className={cn('tabular mt-1.5 text-lg font-semibold tracking-tight', stat.tone)}>{stat.value}</dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled title="The share token contract ships after the escrow audit.">
          Buy shares — coming soon
        </Button>
        <p className="text-[11px] leading-snug text-slate-500">
          Estimated APR is derived from trailing 30-day escrow revenue. Not an offer of securities.
        </p>
      </div>
    </div>
  );
}
