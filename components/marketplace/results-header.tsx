import { ArrowUpDown } from 'lucide-react';
import type { SortKey } from '@/lib/data/agents';
import { MARKET_STATS } from '@/lib/data/stats';
import { formatNumber } from '@/lib/utils';
import { sortLabel } from './marketplace-config';

export interface ResultsHeaderProps {
  count: number;
  total: number;
  categoryName?: string;
  q?: string;
  sort: SortKey;
}

/** "N of M agents" line with sort + indexer status. Server-safe. */
export function ResultsHeader({ count, total, categoryName, q, sort }: ResultsHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
      <p className="text-slate-400" aria-live="polite">
        <span className="tabular font-semibold text-white">{count}</span>
        <span> of </span>
        <span className="tabular">{total}</span>
        <span> agents</span>
        {categoryName && (
          <>
            <span> in </span>
            <span className="font-medium text-slate-200">{categoryName}</span>
          </>
        )}
        {q && (
          <>
            <span> matching </span>
            <span className="font-medium text-slate-200">&ldquo;{q}&rdquo;</span>
          </>
        )}
      </p>
      <p className="flex items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
          Sorted by {sortLabel(sort)}
        </span>
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <span className="relative flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Indexed to block{' '}
          <span className="tabular font-mono text-slate-400">{formatNumber(MARKET_STATS.lastIndexedBlock, { compact: false })}</span>
        </span>
      </p>
    </div>
  );
}
