import Link from 'next/link';
import { ArrowRight, WifiOff } from '@/components/ui/icons';
import type { CategoryId, IndexedAgent } from '@/lib/types';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { AgentCard } from '@/components/marketplace/agent-card';
import { cn } from '@/lib/utils';

export interface SimilarAgentsProps {
  /** Peers resolved by the page - this component never queries the index itself. */
  peers: IndexedAgent[];
  category: CategoryId;
  /** True when the peer query came back from a degraded index. */
  degraded?: boolean;
  className?: string;
}

/**
 * Same-category agents, ranked by reputation.
 *
 * The detail page fetches these and passes them in, so one page load makes one
 * extra call against a 288k index rather than one per rendered component.
 */
export function SimilarAgents({ peers, category, degraded, className }: SimilarAgentsProps) {
  const meta = CATEGORY_MAP[category];

  return (
    <div className={cn('space-y-2.5', className)}>
      {peers.length > 0 ? (
        <ul className="space-y-2.5">
          {peers.map((peer) => (
            <li key={peer.slug}>
              <AgentCard agent={peer} compact />
            </li>
          ))}
        </ul>
      ) : degraded ? (
        <p className="flex items-start gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-slate-500">
          <WifiOff className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          The ERC-8004 index is not answering right now, so peers could not be loaded.
        </p>
      ) : (
        <p className="rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-slate-500">
          No other {meta.name.toLowerCase()} agents surfaced in the ranked window.
        </p>
      )}

      <Link
        href={`/marketplace?category=${meta.id}`}
        className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-bnb transition-colors hover:text-bnb-300 ring-focus"
      >
        All {meta.name.toLowerCase()} agents
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
