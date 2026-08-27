import Link from 'next/link';
import { ChartPie, Gift, Percent, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { AGENTS } from '@/lib/data/agents';
import type { Agent, FractionalOffer } from '@/lib/types';
import { cn, formatNumber, formatPct, formatToken } from '@/lib/utils';

/** Shares the demo wallet holds, keyed by agent id. Deterministic by design. */
const DEMO_SHARES: Record<string, number> = {
  'gridforge-pro': 120,
  yieldrouter: 500,
  rangerider: 250,
  listamaxx: 180,
};
const FALLBACK_SHARES = 100;

export interface FractionalHolding {
  agent: Agent;
  offer: FractionalOffer;
  shares: number;
  valueBnb: number;
  /** Estimated yearly revenue share at the offer's APR */
  yearlyBnb: number;
}

export function getDemoHoldings(): FractionalHolding[] {
  return AGENTS.filter((a): a is Agent & { fractional: FractionalOffer } => !!a.fractional?.enabled).map((agent) => {
    const shares = DEMO_SHARES[agent.id] ?? FALLBACK_SHARES;
    const valueBnb = shares * agent.fractional.sharePriceBnb;
    return { agent, offer: agent.fractional, shares, valueBnb, yearlyBnb: valueBnb * (agent.fractional.apr / 100) };
  });
}

export function FractionalHoldings({ className }: { className?: string }) {
  const holdings = getDemoHoldings();
  const totalValue = holdings.reduce((acc, h) => acc + h.valueBnb, 0);
  const totalYearly = holdings.reduce((acc, h) => acc + h.yearlyBnb, 0);

  return (
    <GlassCard as="section" aria-labelledby="holdings-heading" padded={false} className={cn('overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div>
          <h2 id="holdings-heading" className="flex items-center gap-2 text-sm font-semibold text-white">
            <ChartPie className="h-4 w-4 text-rose-300" aria-hidden />
            Fractional holdings
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Revenue-share tokens from agents you back</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-base font-semibold tabular text-white">{formatToken(totalValue, 'BNB')}</p>
          <p className="text-[11px] text-slate-500">
            <span className="font-mono tabular text-emerald-300">{formatToken(totalYearly, 'BNB')}</span> est. / yr
          </p>
        </div>
      </div>

      <ul className="divide-y divide-white/[0.06]">
        {holdings.map(({ agent, offer, shares, valueBnb }) => (
          <li key={agent.id} className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[11px] font-semibold text-white shadow-card',
                  agent.avatar.gradient,
                )}
              >
                {agent.avatar.initials}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/agents/${agent.id}`} className="ring-focus block truncate rounded text-sm font-medium text-white hover:text-bnb">
                  {agent.name}
                </Link>
                <p className="truncate text-[11px] text-slate-500">
                  <span className="font-mono tabular text-slate-300">
                    {formatNumber(shares, { compact: false })} {offer.tokenSymbol}
                  </span>
                  {' · '}
                  {formatNumber(offer.holders, { compact: false })} holders
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm tabular text-white">{formatToken(valueBnb, 'BNB')}</p>
                <p className="font-mono text-[11px] tabular text-slate-500">@ {offer.sharePriceBnb} BNB</p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="rose" icon={<Percent className="h-3 w-3" aria-hidden />}>
                {offer.revenueShare}% revenue share
              </Badge>
              <Badge tone="emerald" icon={<TrendingUp className="h-3 w-3" aria-hidden />}>
                {formatPct(offer.apr, { sign: false, decimals: 1 })} APR
              </Badge>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 border-t border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">Revenue accrues on every escrow release and is claimable on-chain.</p>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone="slate">Coming soon</Badge>
          <Button size="sm" variant="outline" disabled aria-disabled="true" title="Coming soon" leftIcon={<Gift className="h-3.5 w-3.5" aria-hidden />}>
            Claim revenue
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}
