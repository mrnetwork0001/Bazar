import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Gauge, Network, Timer, Users } from 'lucide-react';
import { AGENTS, getAgent } from '@/lib/data/agents';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { Button } from '@/components/ui/button';
import { HireButton } from '@/components/hire/hire-button';
import { A2APanel } from '@/components/agents/a2a-panel';
import { AgentHeader } from '@/components/agents/agent-header';
import { Capabilities } from '@/components/agents/capabilities';
import { FractionalPanel } from '@/components/agents/fractional-panel';
import { MetricsGrid } from '@/components/agents/metrics-grid';
import { PerformanceChart } from '@/components/agents/performance-chart';
import { PricingTiers } from '@/components/agents/pricing-tiers';
import { ReputationPanel } from '@/components/agents/reputation-panel';
import { AgentSection } from '@/components/agents/section';
import { SimilarAgents } from '@/components/agents/similar-agents';
import { formatNumber, formatToken, periodLabel } from '@/lib/utils';

interface AgentPageProps {
  params: { id: string };
}

/** Every indexed agent is pre-rendered at build time. */
export function generateStaticParams() {
  return AGENTS.map((agent) => ({ id: agent.id }));
}

export function generateMetadata({ params }: AgentPageProps): Metadata {
  const agent = getAgent(params.id);
  if (!agent) return { title: 'Agent not found' };

  return {
    title: agent.name,
    description: agent.tagline,
    alternates: { canonical: `/agents/${agent.id}` },
    openGraph: {
      type: 'profile',
      title: `${agent.name} · Bazar`,
      description: agent.tagline,
      url: `/agents/${agent.id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${agent.name} · Bazar`,
      description: agent.tagline,
    },
  };
}

export default function AgentPage({ params }: AgentPageProps) {
  const agent = getAgent(params.id);
  if (!agent) notFound();

  const category = CATEGORY_MAP[agent.category];
  const weeklyTier = agent.pricing.find((tier) => tier.id === 'weekly') ?? agent.pricing[0];
  const hasPnl = agent.metrics.roi30d !== 0;

  const railStats = [
    {
      key: 'sla',
      label: 'SLA score',
      value: `${agent.metrics.slaScore.toFixed(1)} / 100`,
      icon: Gauge,
      hint: 'Escrow SLA terms met over the last 30 days.',
    },
    {
      key: 'active',
      label: 'Active hires',
      value: formatNumber(agent.metrics.activeHires, { compact: false }),
      icon: Users,
      hint: 'Escrows currently open against this agent.',
    },
    {
      key: 'latency',
      label: 'Avg response',
      value: `${formatNumber(agent.metrics.avgResponseMs, { compact: false })} ms`,
      icon: Timer,
      hint: 'Median time from trigger to delivered action.',
    },
  ] as const;

  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-hero-glow opacity-70" aria-hidden />

      <div className="container-x pb-24 pt-6 sm:pt-8">
        {/* breadcrumb */}
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <li>
              <Link
                href="/marketplace"
                className="rounded px-1 py-0.5 transition-colors hover:text-slate-200 ring-focus"
              >
                Marketplace
              </Link>
            </li>
            <li aria-hidden className="flex items-center">
              <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
            </li>
            <li>
              <Link
                href={`/marketplace?category=${category.id}`}
                className="rounded px-1 py-0.5 transition-colors hover:text-slate-200 ring-focus"
              >
                {category.name}
              </Link>
            </li>
            <li aria-hidden className="flex items-center">
              <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
            </li>
            <li>
              <span aria-current="page" className="px-1 py-0.5 font-medium text-slate-300">
                {agent.name}
              </span>
            </li>
          </ol>
        </nav>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ------------------------------ main ------------------------------ */}
          <div className="min-w-0 space-y-10">
            <AgentHeader agent={agent} />

            <AgentSection
              id="performance"
              title="Performance"
              description={
                hasPnl
                  ? 'Realised results reconstructed from the agent’s settled on-chain activity.'
                  : 'Service telemetry for an agent that guards positions rather than trading them — reliability, not PnL.'
              }
            >
              <div className="space-y-3">
                <MetricsGrid agent={agent} />
                <PerformanceChart agent={agent} />
              </div>
            </AgentSection>

            <AgentSection
              id="trust"
              title="ERC-8004 trust stack"
              description="Bazar reads identity, reputation and validation straight from the three on-chain registries."
            >
              <ReputationPanel agent={agent} />
            </AgentSection>

            <AgentSection
              id="capabilities"
              title="Capabilities"
              description={`${category.agentType} · ${category.tagline}.`}
            >
              <Capabilities agent={agent} />
            </AgentSection>

            <AgentSection
              id="pricing"
              title="Pricing & escrow"
              description="Every plan is escrow-backed on BNB Smart Chain. Payout releases only when the SLA is verified."
            >
              <PricingTiers agent={agent} />
            </AgentSection>

            <AgentSection
              id="a2a"
              title="Hire from your own agent"
              description="The same listing, exposed to machines through the Bazar A2A router."
            >
              <A2APanel agent={agent} />
            </AgentSection>

            {agent.fractional?.enabled && (
              <AgentSection
                id="fractional"
                title="Fractional ownership"
                description="Back this agent and earn a share of every escrow it settles."
              >
                <FractionalPanel agent={agent} />
              </AgentSection>
            )}
          </div>

          {/* ------------------------------ rail ------------------------------ */}
          <aside className="min-w-0 lg:sticky lg:top-24">
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/[0.12] bg-white/[0.05] p-5 shadow-card backdrop-blur-2xl">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs text-slate-500">from</span>
                  <span className="tabular text-2xl font-semibold tracking-tight text-white">
                    {weeklyTier ? formatToken(weeklyTier.price, weeklyTier.currency) : '—'}
                  </span>
                  <span className="text-xs text-slate-500">{weeklyTier ? periodLabel(weeklyTier.period) : ''}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                  Locked in escrow on BNB Smart Chain. Refunded automatically if the SLA is missed.
                </p>

                <HireButton agent={agent} size="lg" variant="primary" className="mt-4 w-full" />

                <Button
                  href="/developers#try-it"
                  variant="outline"
                  className="mt-2.5 w-full"
                  leftIcon={<Network className="h-4 w-4" aria-hidden />}
                >
                  A2A hire
                </Button>

                <dl className="mt-5 space-y-2.5 border-t border-white/[0.08] pt-4">
                  {railStats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.key} className="flex items-center justify-between gap-3" title={stat.hint}>
                        <dt className="inline-flex items-center gap-2 text-xs text-slate-500">
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                          {stat.label}
                        </dt>
                        <dd className="tabular text-xs font-semibold text-white">{stat.value}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>

              <div>
                <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Similar {category.shortName.toLowerCase()} agents
                </h2>
                <SimilarAgents agent={agent} className="mt-3" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
