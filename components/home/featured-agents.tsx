import { AgentCard } from '@/components/marketplace/agent-card';
import { Reveal } from '@/components/home/reveal';
import { SectionHeading } from '@/components/home/section-heading';
import { getFeaturedAgents } from '@/lib/data/agents';

export function FeaturedAgents() {
  const agents = getFeaturedAgents(4);
  return (
    <section id="featured" className="container-x py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Featured agents"
          title="Top-rated on BSC this week"
          description="Verified identity, on-chain reputation and live telemetry. Ranked by ERC-8004 reputation score."
          action={{ href: '/marketplace', label: 'View all agents' }}
        />
      </Reveal>
      <Reveal className="mt-10" delay={0.08}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {agents.map((agent, i) => (
            <AgentCard key={agent.id} agent={agent} index={i} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
