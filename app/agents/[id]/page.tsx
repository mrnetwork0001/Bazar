import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ChevronRight, MessageSquare, Network, Star, Trophy } from '@/components/ui/icons';
import { queryAgents } from '@/lib/agents/repository';
import { resolveAgentDetail } from './resolve';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { Button } from '@/components/ui/button';
import { HireButton } from '@/components/hire/hire-button';
import { AgentHeader } from '@/components/agents/agent-header';
import { Capabilities } from '@/components/agents/capabilities';
import { IdentityPanel } from '@/components/agents/identity-panel';
import { ReputationPanel } from '@/components/agents/reputation-panel';
import { AgentSection } from '@/components/agents/section';
import { SimilarAgents } from '@/components/agents/similar-agents';
import { UnresolvedAgent } from '@/components/agents/unresolved-agent';
import { formatScore } from '@/components/agents/reputation-format';
import { formatNumber } from '@/lib/utils';
import type { CategoryId } from '@/lib/types';

/**
 * Slugs are "<chainId>-<tokenId>". There are 287,993 identities on BSC alone,
 * so nothing is prerendered - `generateStaticParams` is deliberately absent
 * and the route renders on demand. The indexer client caches its own fetches,
 * so a popular agent still costs one upstream call per revalidation window.
 */
const SLUG_RE = /^(\d+)-(\d+)$/;

interface AgentPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: AgentPageProps): Promise<Metadata> {
  const match = SLUG_RE.exec(params.id);
  // Must 404 here too: if metadata resolves while the page throws notFound(),
  // Next commits the head first and the response goes out as 200.
  if (!match) notFound();

  const resolved = await resolveAgentDetail(Number(match[1]), match[2], params.id);
  if (!resolved) {
    return {
      title: 'Agent not resolved',
      description: 'This ERC-8004 identity could not be resolved from the live index.',
      robots: { index: false },
    };
  }

  const { agent } = resolved;
  const description = agent.description.trim()
    ? agent.description.trim().slice(0, 155)
    : `ERC-8004 agent #${agent.tokenId} on BNB Smart Chain - identity and reputation as published on chain.`;

  return {
    title: agent.name,
    description,
    alternates: { canonical: `/agents/${agent.slug}` },
    openGraph: {
      type: 'profile',
      title: `${agent.name} · Bazar`,
      description,
      url: `/agents/${agent.slug}`,
      images: agent.imageUrl ? [agent.imageUrl] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${agent.name} · Bazar`,
      description,
    },
  };
}

export default async function AgentPage({ params }: AgentPageProps) {
  const match = SLUG_RE.exec(params.id);
  // A slug that is not "<chainId>-<tokenId>" can never name an identity.
  if (!match) notFound();

  const resolved = await resolveAgentDetail(Number(match[1]), match[2], params.id);
  if (!resolved) {
    // The index answered but has no such identity, or it is unreachable - a
    // different claim from "does not exist", so it is not a 404.
    return <UnresolvedAgent chainId={Number(match[1])} tokenId={match[2]} />;
  }

  const { agent, extras } = resolved;

  const category = CATEGORY_MAP[agent.category];
  const rep = agent.reputation;
  const a2aPath = `/api/v1/a2a/agents/${agent.slug}`;

  // Bazar's classifier assigned this agent's category by hash when its
  // registration matched no category term. In that case the section heading may
  // not assert what the agent does: that would be an unsourced functional claim
  // about a named identity, which is exactly what the no-invented-data rule
  // exists to prevent.
  //
  // Branch on `categoryConfidence`, never on the wording of `categoryReason`:
  // the reason string is display copy and is free to be rewritten.
  const unclassified = agent.categoryConfidence === 'unclassified';

  const railStats = [
    {
      key: 'score',
      label: 'Reputation',
      value: `${formatScore(rep.totalScore)} / 100`,
      icon: Trophy,
      hint: 'Aggregate ERC-8004 reputation score published by the index.',
    },
    {
      key: 'feedback',
      label: 'Feedback',
      // Zero feedback is the normal case on BSC, not a poor showing, so the
      // rail says so in words rather than printing a bare 0.
      value:
        rep.totalFeedbacks > 0
          ? `${formatNumber(rep.totalFeedbacks, { compact: false })} ${rep.totalFeedbacks === 1 ? 'entry' : 'entries'}`
          : 'No feedback yet',
      icon: MessageSquare,
      hint: 'Feedback entries written to the Reputation Registry.',
    },
    {
      key: 'stars',
      label: 'Stars',
      value: formatNumber(rep.starCount, { compact: false }),
      icon: Star,
      hint: 'Stars recorded against this identity.',
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
              <Link href="/marketplace" className="rounded px-1 py-0.5 transition-colors hover:text-slate-200 ring-focus">
                Marketplace
              </Link>
            </li>
            <li aria-hidden className="flex items-center">
              <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
            </li>
            <li>
              {/* An unclassified agent has no shelf to point at: its category
                  was assigned by hash for coverage, and the breadcrumb must not
                  state it as fact when the header below says otherwise. */}
              {unclassified ? (
                <Link href="/marketplace" className="rounded px-1 py-0.5 transition-colors hover:text-slate-200 ring-focus">
                  Unclassified
                </Link>
              ) : (
                <Link
                  href={`/marketplace?category=${category.id}`}
                  className="rounded px-1 py-0.5 transition-colors hover:text-slate-200 ring-focus"
                >
                  {category.name}
                </Link>
              )}
            </li>
            <li aria-hidden className="flex items-center">
              <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
            </li>
            <li className="min-w-0">
              <span aria-current="page" className="block truncate px-1 py-0.5 font-medium text-slate-300">
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
              id="reputation"
              title="Reputation"
              description="Read straight from the ERC-8004 reputation index. Where the registry publishes nothing, this page says so rather than filling the gap."
            >
              <ReputationPanel agent={agent} scores={extras.scores} scoredAt={extras.scoredAt} />
            </AgentSection>

            <AgentSection
              id="capabilities"
              title="Capabilities"
              description={
                unclassified
                  ? 'ERC-8004 publishes no category field, and nothing in this agent\u2019s registration matched one of Bazar\u2019s category terms. What follows is only what the identity itself declares.'
                  : `${category.agentType} \u00b7 ${category.tagline}.`
              }
            >
              <Capabilities
                agent={agent}
                a2aPath={a2aPath}
                endpoints={extras.endpoints}
                tags={extras.tags}
                trustModels={extras.trustModels}
              />
            </AgentSection>

            <AgentSection
              id="identity"
              title="ERC-8004 identity"
              description="The onchain record behind this listing. Every value is copyable and links to BscScan, so nothing here has to be taken on trust."
            >
              <IdentityPanel
                agent={agent}
                agentWallet={extras.agentWallet}
                registrationTx={extras.registrationTx}
              />
            </AgentSection>
          </div>

          {/* ------------------------------ rail ------------------------------ */}
          <aside className="min-w-0 lg:sticky lg:top-24">
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/[0.12] bg-white/[0.05] p-5 shadow-card backdrop-blur-2xl">
                <h2 className="break-words text-sm font-semibold text-white">Hire {agent.name}</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                  Pricing is negotiated onchain via ERC-8183. ERC-8004 publishes identity and reputation only, so
                  Bazar shows no rate card and no quote.
                </p>

                <HireButton agent={agent} size="lg" variant="primary" className="mt-4 w-full" />

                <Button
                  href="/developers#try-it"
                  variant="outline"
                  className="mt-2.5 w-full"
                  leftIcon={<Network className="h-4 w-4" aria-hidden />}
                >
                  Hire from an agent
                </Button>

                <dl className="mt-5 space-y-2.5 border-t border-white/[0.08] pt-4">
                  {railStats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.key} className="flex items-center justify-between gap-3">
                        <dt className="inline-flex items-center gap-2 text-xs text-slate-500" title={stat.hint}>
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                          {stat.label}
                          {/* `title` is mouse-only, so the same sentence is read
                              out to assistive tech rather than being lost. */}
                          <span className="sr-only">. {stat.hint}</span>
                        </dt>
                        <dd className="tabular text-xs font-semibold text-white">{stat.value}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>

              <div>
                <h2 className="break-words text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Similar {category.shortName.toLowerCase()} agents
                </h2>
                {/* Suspended so the agent renders immediately: this is a second
                    serial round trip against the index that only fills a rail. */}
                <Suspense fallback={<PeerRailSkeleton />}>
                  <PeerRail category={agent.category} slug={agent.slug} />
                </Suspense>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- peer rail ------------------------------- */

/**
 * Same-category peers, resolved in their own suspended subtree.
 *
 * The window is deliberately the repository's full one. `limit: 4` made the
 * repository request `min(4 * 4, 100) = 16` raw records and classify those,
 * about four per category, which on the top-ranked agent returned two peers,
 * both copies of the same memecoin listing. Asking for 24 makes it fetch the
 * full 100-record page for the same single upstream call, and near-duplicate
 * registrations are collapsed by owner + name so the rail cannot recommend the
 * same identity three times.
 */
async function PeerRail({ category, slug }: { category: CategoryId; slug: string }) {
  const page = await queryAgents({ category, sort: 'reputation', limit: 24 });

  const seen = new Set<string>();
  const peers: typeof page.agents = [];
  for (const peer of page.agents) {
    if (peer.slug === slug) continue;
    const key = `${peer.owner.toLowerCase()}|${peer.name.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    peers.push(peer);
    if (peers.length === 3) break;
  }

  return <SimilarAgents peers={peers} category={category} degraded={page.degraded} className="mt-3" />;
}

function PeerRailSkeleton() {
  return (
    <div className="mt-3 space-y-2.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="shimmer h-[66px] rounded-xl border border-white/[0.08] bg-white/[0.04]" />
      ))}
    </div>
  );
}
