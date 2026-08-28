import type { IndexedAgent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AgentCard } from './agent-card';
import { EmptyState, IndexUnavailable } from './empty-state';
import { RegisterCtaCard } from './register-cta-card';

export interface AgentGridProps {
  agents: IndexedAgent[];
  /** True when the indexer was unreachable - a different state from "no matches". */
  degraded?: boolean;
  error?: string;
  /** Active search term, so the empty state can name it. */
  q?: string;
  categoryName?: string;
  /** Append the "List your agent" card at the end (default true). */
  showRegisterCta?: boolean;
  className?: string;
}

/** Responsive 1 / 2 / 3 column grid of agent cards. Server-safe. */
export function AgentGrid({
  agents,
  degraded,
  error,
  q,
  categoryName,
  showRegisterCta = true,
  className,
}: AgentGridProps) {
  if (degraded) {
    return <IndexUnavailable error={error} />;
  }

  return (
    <ul role="list" className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {agents.length === 0 && (
        <li className="col-span-full">
          <EmptyState q={q} categoryName={categoryName} />
        </li>
      )}
      {agents.map((agent, index) => (
        <li key={agent.slug} className="min-w-0">
          <AgentCard agent={agent} index={index} />
        </li>
      ))}
      {showRegisterCta && agents.length > 0 && (
        <li className="min-w-0">
          <RegisterCtaCard />
        </li>
      )}
    </ul>
  );
}
