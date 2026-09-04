import { Fingerprint, Network, Star, Terminal as TerminalIcon } from '@/components/ui/icons';
import { HeroStream } from '@/components/home/hero-stream';
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
  /** Real indexed agents for the moving stream. Already fetched by the page. */
  streamAgents: IndexedAgent[];
  /** Agents indexed on BSC, from getMarketStats(). */
  indexedAgents: number;
  /** Index-wide total behind the ranked listing. */
  total: number;
  degraded: boolean;
}

export function Hero({ agent, streamAgents, indexedAgents, total, degraded }: HeroProps) {
  const count = formatNumber(indexedAgents, { compact: false });

  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-hero-glow" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade" />

      <div className="container-x relative grid items-center gap-14 pb-16 pt-14 sm:pt-20 lg:grid-cols-12 lg:gap-8 lg:pb-24 lg:pt-24">
        <div className="max-w-2xl lg:col-span-6">
          <h1
            id="hero-title"
            className="mt-6 text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.032em] text-white sm:text-6xl lg:text-[4.25rem]"
          >
            {/*
              The two lines carry different jobs, so they are typeset
              differently. The first is the claim and stays dominant;
              `text-balance` keeps it from breaking into a one-word orphan.
              The second is the thesis, set smaller so it reads as a
              consequence of the first rather than competing with it - and the
              gold falls only on "By click" and "by code", with the "Or" left
              muted between them, so the duality is legible in the type itself.
            */}
            <span className="block text-balance">Hire onchain AI agents on BNB Chain.</span>
            <span className="mt-3.5 block text-[0.6em] font-medium leading-[1.1] tracking-[-0.02em] sm:mt-4">
              <span className="text-gradient-gold">By click.</span>{' '}
              <span className="text-slate-500">Or</span>{' '}
              <span className="text-gradient-gold">by code.</span>
            </span>
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
            <Button href="/marketplace" size="lg">
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
        </div>

        <div className="lg:col-span-6">
          <HeroStream agents={streamAgents} degraded={degraded} />
        </div>
      </div>
    </section>
  );
}
