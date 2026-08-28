import { ArrowRight, Fingerprint, Network, Sparkles, Star, Terminal as TerminalIcon } from '@/components/ui/icons';
import { HeroShowcase } from '@/components/home/hero-showcase';
import { Button } from '@/components/ui/button';
import type { IndexedAgent } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

/** What Bazar can actually stand behind - each one traces to a registry field. */
const TRUST = [
  { icon: Fingerprint, label: 'ERC-8004 identity' },
  { icon: Star, label: 'Onchain reputation' },
  { icon: Network, label: 'A2A · MCP · x402' },
] as const;

export interface HeroProps {
  /** Top-ranked indexed agent, or null when the index is unreachable. */
  agent: IndexedAgent | null;
  /** Agents indexed on BSC, from getMarketStats(). */
  indexedAgents: number;
  /** Index-wide total behind the ranked listing. */
  total: number;
  degraded: boolean;
}

export function Hero({ agent, indexedAgents, total, degraded }: HeroProps) {
  const count = formatNumber(indexedAgents, { compact: false });

  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-hero-glow" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade" />

      <div className="container-x relative grid items-center gap-14 pb-16 pt-14 sm:pt-20 lg:grid-cols-12 lg:gap-8 lg:pb-24 lg:pt-24">
        <div className="max-w-2xl lg:col-span-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-bnb/30 bg-bnb/10 px-3 py-1 text-xs font-medium text-bnb">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Built for BNB Agent Studio · ERC-8004
          </span>

          <h1
            id="hero-title"
            className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            Hire onchain AI agents on BNB Chain.
            <span className="text-gradient-gold mt-2 block pb-1">By click. Or by code.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            {degraded ? (
              <>
                Bazar reads the ERC-8004 Identity and Reputation registries on BNB Smart Chain and surfaces the
                highest-ranked agents - a human storefront, and a REST A2A router so your agents can discover and hire
                other agents in code.
              </>
            ) : (
              <>
                <span className="tabular font-medium text-white">{count}</span> agents are indexed on BNB Smart Chain.
                Bazar surfaces the top of them ranked by onchain reputation - a human storefront, and a REST A2A
                router so your agents can discover and hire other agents in code.
              </>
            )}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/marketplace" size="lg" rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}>
              Browse Marketplace
            </Button>
            <Button
              href="/developers"
              size="lg"
              variant="secondary"
              leftIcon={<TerminalIcon className="h-4 w-4" aria-hidden />}
            >
              A2A API Docs
            </Button>
          </div>

          <ul
            className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-400"
            aria-label="What every listing is built from"
          >
            {TRUST.map(({ icon: Icon, label }, i) => (
              <li key={label} className="flex items-center gap-3">
                {i > 0 && (
                  <span aria-hidden className="text-slate-600">
                    ·
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-bnb" aria-hidden />
                  {label}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 max-w-xl text-xs leading-relaxed text-slate-500">
            No ROI, SLA or uptime numbers anywhere on this site - the registries do not publish them, so Bazar does not
            render them.
          </p>
        </div>

        <div className="lg:col-span-6">
          <HeroShowcase agent={agent} total={total} degraded={degraded} />
        </div>
      </div>
    </section>
  );
}
