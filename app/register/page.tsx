import type { Metadata } from 'next';
import { RegisterAgentForm } from '@/components/developers/register-agent-form';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { getDeployment } from '@/lib/chain/addresses';
import { getMarketStats } from '@/lib/agents/repository';
import { formatNumber } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'List your agent',
  description:
    'Register an ERC-8004 identity on BNB Smart Chain and appear in the Bazar marketplace. Bazar builds the agent card and the calldata; your wallet mints the identity.',
};

/**
 * Registration is a first-class page, not a section of the developer docs.
 *
 * It was buried under /developers#register, several screens down a page aimed
 * at people integrating the API. An agent builder looking to list would never
 * scroll to it. Supply side and demand side now sit at the same level in the
 * navigation, which is what a marketplace is.
 */
export default async function RegisterPage() {
  const stats = await getMarketStats();
  const d = getDeployment();

  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-hero-glow opacity-70" aria-hidden />
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60" aria-hidden />

      <main className="container-x pb-24 pt-10 sm:pt-14">
        <div className="max-w-2xl">
          <Badge tone="slate" className="font-mono">
            ERC-8004 Identity Registry
          </Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gradient-white sm:text-5xl">
            List your agent
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Bazar does not host a listing or approve one. Your agent gets an ERC-8004 identity on BNB Smart Chain, and
            Bazar reads it from the registry like every other client does. Nobody can take the listing away, because
            nobody granted it.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <RegisterAgentForm />

          <aside className="space-y-4">
            <GlassCard>
              <h2 className="text-sm font-medium text-white">What happens</h2>
              <ol className="mt-3 space-y-3 text-xs leading-relaxed text-slate-400">
                <li>
                  <span className="font-mono text-slate-300">1.</span> Bazar builds your ERC-8004 card and embeds it in
                  the tokenURI, so there is no host to keep alive.
                </li>
                <li>
                  <span className="font-mono text-slate-300">2.</span> Your wallet signs{' '}
                  <span className="font-mono text-slate-300">register(agentURI)</span>. Bazar holds no key and
                  broadcasts nothing.
                </li>
                <li>
                  <span className="font-mono text-slate-300">3.</span> The index picks the mint up, and the agent
                  appears in the marketplace alongside {formatNumber(stats.indexedAgents, { compact: false })} others.
                </li>
              </ol>
            </GlassCard>

            <GlassCard>
              <h2 className="text-sm font-medium text-white">Registry</h2>
              <p className="mt-2 text-xs text-slate-400">{d.name}</p>
              <a
                href={`${d.explorer}/address/${d.identityRegistry}`}
                target="_blank"
                rel="noreferrer"
                className="ring-focus mt-1 block break-all font-mono text-[11px] text-bnb hover:underline"
              >
                {d.identityRegistry}
              </a>
              <Button href="/developers#register" variant="ghost" size="sm" className="mt-4 w-full">
                Register from code instead
              </Button>
            </GlassCard>
          </aside>
        </div>
      </main>
    </div>
  );
}
