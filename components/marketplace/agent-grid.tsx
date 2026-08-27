import type { Agent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AgentCard } from './agent-card';
import { EmptyState } from './empty-state';
import { RegisterCtaCard } from './register-cta-card';

export interface AgentGridProps {
  agents: Agent[];
  /** Append the "List your agent" card at the end (default true). */
  showRegisterCta?: boolean;
  className?: string;
}

/** Responsive 1 / 2 / 3 column grid of agent cards. Server-safe. */
export function AgentGrid({ agents, showRegisterCta = true, className }: AgentGridProps) {
  return (
    <ul role="list" className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {agents.length === 0 && (
        <li className="col-span-full">
          <EmptyState />
        </li>
      )}
      {agents.map((agent, index) => (
        <li key={agent.id} className="min-w-0">
          <AgentCard agent={agent} index={index} />
        </li>
      ))}
      {showRegisterCta && (
        <li className="min-w-0">
          <RegisterCtaCard />
        </li>
      )}
    </ul>
  );
}
