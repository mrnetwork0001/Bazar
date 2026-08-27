import Link from 'next/link';
import { ArrowRight, Coins, PieChart, TrendingUp, Users } from 'lucide-react';
import { Reveal } from '@/components/home/reveal';
import { SectionHeading } from '@/components/home/section-heading';
import { Badge } from '@/components/ui/badge';
import { AGENTS } from '@/lib/data/agents';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { cn, formatNumber, formatPct, formatToken } from '@/lib/utils';

/**
 * Fractional revenue-share teaser. Lists every agent that has opened a
 * revenue-share token; each card links straight to that agent's page.
 */
export function FractionalTeaser() {
  const offers = AGENTS.filter((agent) => agent.fractional?.enabled);
  if (offers.length === 0) return null;

  return (
    <section id="fractional" className="container-x py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Fractional ownership"
          title="Own a piece of the best agents"
          description="Top-performing agents open a slice of their revenue to supporters. Hold the share token, earn a cut of every escrow release the agent settles — no lockup, all on BSC."
          action={{ href: '/marketplace?badge=fractional', label: 'See all offers' }}
        />
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {offers.map((agent, i) => {
          const offer = agent.fractional;
          if (!offer) return null;
          const category = CATEGORY_MAP[agent.category];

          const stats = [
            {
              label: 'Revenue share',
              value: formatPct(offer.revenueShare, { sign: false, decimals: 0 }),
              icon: PieChart,
              tone: 'text-white',
            },
            {
              label: 'Est. APR',
              value: formatPct(offer.apr, { sign: false, decimals: 1 }),
              icon: TrendingUp,
              tone: 'text-emerald-300',
            },
            {
              label: 'Holders',
              value: formatNumber(offer.holders, { compact: false }),
              icon: Users,
              tone: 'text-white',
            },
            {
              label: 'Share price',
              value: formatToken(offer.sharePriceBnb, 'BNB'),
              icon: Coins,
              tone: 'text-white',
            },
          ];

          return (
            <Reveal key={agent.id} delay={i * 0.06} className="h-full">
              <Link
                href={`/agents/${agent.id}`}
                aria-label={`${agent.name} — ${offer.tokenSymbol} revenue-share offer`}
                className="glass group flex h-full flex-col rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-400/40 hover:bg-white/[0.06] ring-focus"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold tracking-wide text-white ring-1 ring-inset ring-white/20',
                      agent.avatar.gradient,
                    )}
                  >
                    {agent.avatar.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold leading-tight text-white">{agent.name}</h3>
                    <p className="mt-0.5 truncate text-xs" style={{ color: category.accentHex }}>
                      {category.shortName}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <Badge tone="rose" size="md" icon={<Coins className="h-3.5 w-3.5" aria-hidden />}>
                    <span className="font-mono">{offer.tokenSymbol}</span>
                  </Badge>
                  <span className="tabular font-mono text-[11px] text-slate-500">
                    {formatNumber(offer.supply, { compact: true })} supply
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06]">
                  {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="min-w-0 bg-ink/70 px-3 py-2.5">
                        <dt className="flex items-center gap-1 truncate text-[10px] font-medium uppercase tracking-wider text-slate-500">
                          <Icon className="h-3 w-3 shrink-0" aria-hidden />
                          {stat.label}
                        </dt>
                        <dd className={cn('tabular mt-0.5 truncate text-sm font-semibold', stat.tone)}>{stat.value}</dd>
                      </div>
                    );
                  })}
                </dl>

                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-medium text-bnb transition-transform duration-200 group-hover:translate-x-0.5">
                  View offer
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            </Reveal>
          );
        })}
      </div>

      <Reveal className="mt-6" delay={0.2}>
        <p className="text-center text-xs leading-relaxed text-slate-500">
          Share tokens are minted per agent on BSC. Payouts stream from the same escrow contract that settles hires, so
          holders are paid out of verified work — never out of new deposits.
        </p>
      </Reveal>
    </section>
  );
}
