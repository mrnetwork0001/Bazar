'use client';

import { ArrowUpDown, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_SORT, SORT_OPTIONS, isSortKey, parseSort } from './marketplace-config';
import { useMarketplaceParams } from './use-marketplace-params';

/** Native select bound to `?sort=` (keyboard + screen-reader friendly). Render inside `<Suspense>`. */
export function SortSelect({ className }: { className?: string }) {
  const { searchParams, set } = useMarketplaceParams();
  const current = parseSort(searchParams.get('sort'));

  return (
    <label className={cn('relative inline-flex items-center', className)}>
      <span className="sr-only">Sort agents by</span>
      <ArrowUpDown className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" aria-hidden />
      <select
        value={current}
        onChange={(e) => {
          const next = e.target.value;
          set({ sort: isSortKey(next) && next !== DEFAULT_SORT ? next : null });
        }}
        className={cn(
          'h-10 cursor-pointer appearance-none rounded-xl border border-white/[0.08] bg-white/[0.04] pl-9 pr-9 text-sm font-medium text-slate-200 backdrop-blur-xl',
          'transition-colors hover:border-white/20 hover:text-white ring-focus',
        )}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface text-slate-200">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" aria-hidden />
    </label>
  );
}
