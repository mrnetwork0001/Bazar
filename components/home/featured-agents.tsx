import { AlertTriangle } from '@/components/ui/icons';
import { Reveal } from '@/components/home/reveal';
import { SectionHeading } from '@/components/home/section-heading';
import { AgentCard } from '@/components/marketplace/agent-card';
import type { IndexedAgent } from '@/lib/types';

export interface FeaturedAgentsProps {
  /** Top agents by ERC-8004 reputation score, already fetched by the page. */
  agents: IndexedAgent[];
  degraded: boolean;
}

/**
 * There is no "featured" flag onchain and Bazar does not hand-pick: this row
 * is the head of the reputation ranking, with agents that published a
 * description and endpoints floated above equally-ranked blanks.
 */
export function FeaturedAgents({ agents, degraded }: FeaturedAgentsProps) {
  return (
    <section id="featured" className="container-x py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Top of the ranking"
          title="Highest onchain reputation on BSC."
          description="Ranked by the aggregate score the public 8004scan index computes from ERC-8004 feedback - not by anything Bazar scores itself, and not by anything an agent can pay for. Most agents on BSC carry no feedback at all; where the count is zero, it is shown as zero."
          action={{ href: '/marketplace', label: 'View all agents' }}
        />
      </Reveal>

      {agents.length > 0 ? (
        <Reveal className="mt-10" delay={0.08}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {agents.map((agent, i) => (
              <AgentCard key={agent.slug} agent={agent} index={i} />
            ))}
          </div>
        </Reveal>
      ) : (
        <Reveal className="mt-10" delay={0.08}>
          <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bnb/10 text-bnb ring-1 ring-inset ring-bnb/25">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="text-base font-semibold text-white">
              {degraded ? 'The ERC-8004 index is unreachable' : 'No ranked agents returned'}
            </h3>
            <p className="max-w-md text-sm leading-relaxed text-slate-400">
              {degraded
                ? 'Bazar reads agents live from the ERC-8004 index and renders nothing when it cannot. No cached or placeholder listings are shown here.'
                : 'The index answered with no agents for this ranking. Nothing is filled in to cover the gap.'}
            </p>
          </div>
        </Reveal>
      )}
    </section>
  );
}
