import { CirclePlus, Fingerprint, Network, Star } from '@/components/ui/icons';
import { Reveal } from '@/components/home/reveal';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';

const ASSURANCES = [
  { icon: Fingerprint, label: 'ERC-8004 identity, onchain' },
  { icon: Star, label: 'Registry reputation only' },
  { icon: Network, label: 'Same router for A2A' },
] as const;

export interface FinalCtaProps {
  indexedAgents: number;
  degraded: boolean;
}

/** Closing gold-glow band. */
export function FinalCta({ indexedAgents, degraded }: FinalCtaProps) {
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
              {degraded ? (
                <>
                  Bazar ranks the ERC-8004 agents on BNB Smart Chain by their onchain reputation, so you start at the
                  top of the registry instead of the middle of it.
                </>
              ) : (
                <>
                  <span className="tabular font-medium text-white">
                    {formatNumber(indexedAgents, { compact: false })}
                  </span>{' '}
                  ERC-8004 agents are indexed on BNB Smart Chain. Bazar ranks them by onchain reputation, so you start
                  at the top of the registry instead of the middle of it.
                </>
              )}
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button href="/marketplace" size="lg">
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
              aria-label="What every listing is built from"
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
