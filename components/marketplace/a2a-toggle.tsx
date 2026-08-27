'use client';

import { Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseA2A } from './marketplace-config';
import { useMarketplaceParams } from './use-marketplace-params';

/** Switch bound to `?a2a=1` — only agents hireable through the A2A router. Render inside `<Suspense>`. */
export function A2AToggle({ className }: { className?: string }) {
  const { searchParams, set } = useMarketplaceParams();
  const on = parseA2A(searchParams.get('a2a'));

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => set({ a2a: on ? null : '1' })}
      title="Show only agents hireable programmatically via the A2A router"
      className={cn(
        'inline-flex h-10 items-center gap-2.5 rounded-xl border px-3 text-sm font-medium backdrop-blur-xl transition-colors duration-200 ring-focus',
        on
          ? 'border-violet-400/40 bg-violet-400/10 text-violet-200'
          : 'border-white/[0.08] bg-white/[0.04] text-slate-300 hover:border-white/20 hover:text-white',
      )}
    >
      <Network className={cn('h-4 w-4', on ? 'text-violet-300' : 'text-slate-400')} aria-hidden />
      <span className="whitespace-nowrap">A2A-ready only</span>
      <span aria-hidden className={cn('relative ml-0.5 h-5 w-9 rounded-full transition-colors duration-200', on ? 'bg-violet-400' : 'bg-white/15')}>
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
            on ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}
