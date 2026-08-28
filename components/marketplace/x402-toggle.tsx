'use client';

import { Coins } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { parseX402 } from './marketplace-config';
import { useMarketplaceParams } from './use-marketplace-params';

/**
 * Switch bound to `?x402=1`.
 *
 * This replaces the old "A2A-ready only" toggle: `x402_supported` is a real
 * flag on the index and the only machine-payment filter that can be pushed
 * down to the query, so the label matches what actually happens. Render
 * inside `<Suspense>`.
 */
export function X402Toggle({ className }: { className?: string }) {
  const { searchParams, set, pending } = useMarketplaceParams();
  const on = parseX402(searchParams.get('x402'));

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-busy={pending}
      onClick={() => set({ x402: on ? null : '1', offset: null })}
      title="Show only agents that advertise x402 machine payments on their agent card"
      className={cn(
        'inline-flex h-10 items-center gap-2.5 rounded-xl border px-3 text-sm font-medium backdrop-blur-xl transition-colors duration-200 ring-focus',
        on
          ? 'border-violet-400/40 bg-violet-400/10 text-violet-200'
          : 'border-white/[0.08] bg-white/[0.04] text-slate-300 hover:border-white/20 hover:text-white',
        className,
      )}
    >
      <Coins className={cn('h-4 w-4', on ? 'text-violet-300' : 'text-slate-400')} aria-hidden />
      <span className="whitespace-nowrap">x402 payments</span>
      <span
        aria-hidden
        className={cn('relative ml-0.5 h-5 w-9 rounded-full transition-colors duration-200', on ? 'bg-violet-400' : 'bg-white/15')}
      >
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
