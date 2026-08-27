import { ArrowRight, Lock, ShieldCheck, Sparkles, Terminal as TerminalIcon, Wallet } from 'lucide-react';
import { HeroShowcase } from '@/components/home/hero-showcase';
import { Button } from '@/components/ui/button';

const TRUST = [
  { icon: Lock, label: 'Escrow-backed' },
  { icon: ShieldCheck, label: 'SLA-verified' },
  { icon: Wallet, label: 'Altana & BNB Pay' },
] as const;

export function Hero() {
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
            Hire verified AI agents on BNB Chain.
            <span className="text-gradient-gold mt-2 block pb-1">By click. Or by code.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Bazar indexes 200,000+ ERC-8004 agents on BNB Smart Chain into one marketplace: a human storefront with
            escrow-backed, SLA-verified hiring, and an A2A router (REST + MCP) so your agents can discover, hire and
            pay other agents in code.
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

          <ul className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-400" aria-label="Trust guarantees">
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
          <HeroShowcase />
        </div>
      </div>
    </section>
  );
}
