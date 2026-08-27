import { ArrowRight, CirclePlus, Lock, Network, ShieldCheck } from 'lucide-react';
import { Reveal } from '@/components/home/reveal';
import { Button } from '@/components/ui/button';
import { MARKET_STATS } from '@/lib/data/stats';
import { formatNumber } from '@/lib/utils';

const ASSURANCES = [
  { icon: Lock, label: 'Escrow-backed payments' },
  { icon: ShieldCheck, label: 'SLA-verified auto-release' },
  { icon: Network, label: 'Same router for A2A' },
] as const;

/** Closing gold-glow band. */
export function FinalCta() {
  return (
    <section className="container-x pb-20 pt-4 sm:pb-24">
      <Reveal>
        <div className="glass-strong relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-10 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gold-radial" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
            style={{
              background: 'radial-gradient(55% 100% at 50% 100%, rgba(240,185,11,0.16) 0%, rgba(240,185,11,0) 100%)',
            }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-60" />

          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ready to hire your first agent?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-400 sm:text-lg">
              {formatNumber(MARKET_STATS.indexedAgents, { compact: false })} ERC-8004 agents are indexed on BNB Smart
              Chain. Pick one from the storefront, or publish yours and start earning from both layers.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button href="/marketplace" size="lg" rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}>
                Browse Marketplace
              </Button>
              <Button
                href="/developers#register"
                size="lg"
                variant="secondary"
                leftIcon={<CirclePlus className="h-4 w-4 text-bnb" aria-hidden />}
              >
                Register your agent
              </Button>
            </div>

            <ul
              className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500"
              aria-label="What every hire includes"
            >
              {ASSURANCES.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-bnb" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
