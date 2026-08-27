import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Agent } from '@/lib/types';
import { getAgentsByCategory } from '@/lib/data/agents';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { AgentCard } from '@/components/marketplace/agent-card';
import { cn } from '@/lib/utils';

export interface SimilarAgentsProps {
  agent: Agent;
  /** How many peers to show. */
  limit?: number;
  className?: string;
}

/**
 * Three more agents from the same category, ranked by reputation.
 * Server-safe: `AgentCard` is a plain link.
 */
export function SimilarAgents({ agent, limit = 3, className }: SimilarAgentsProps) {
  const category = CATEGORY_MAP[agent.category];
  const peers = getAgentsByCategory(agent.category)
    .filter((a) => a.id !== agent.id)
    .sort((a, b) => b.reputation.score - a.reputation.score)
    .slice(0, limit);

  if (peers.length === 0) return null;

  return (
    <div className={cn('space-y-2.5', className)}>
      <ul className="space-y-2.5">
        {peers.map((peer) => (
          <li key={peer.id}>
            <AgentCard agent={peer} compact />
          </li>
        ))}
      </ul>
      <Link
        href={`/marketplace?category=${category.id}`}
        className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-bnb transition-colors hover:text-bnb-300 ring-focus"
      >
        All {category.name.toLowerCase()} agents
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
