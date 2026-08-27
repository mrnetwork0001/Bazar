'use client';

import { Check, Sparkles } from 'lucide-react';
import type { PricingTier } from '@/lib/types';
import { cn, formatToken, periodLabel } from '@/lib/utils';

export interface TierPickerProps {
  tiers: PricingTier[];
  value: string;
  onChange: (tierId: string) => void;
  /** Radio group name; must be unique per open modal. */
  name: string;
  className?: string;
}

/**
 * Radio cards for the agent's pricing tiers. Uses real `<input type="radio">`
 * elements so arrow-key navigation and screen-reader grouping come for free.
 */
export function TierPicker({ tiers, value, onChange, name, className }: TierPickerProps) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Plan</legend>
      <div className="mt-2 space-y-2">
        {tiers.map((tier) => {
          const selected = tier.id === value;
          return (
            <label
              key={tier.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all duration-200',
                selected
                  ? 'border-bnb/50 bg-bnb/[0.08] shadow-glow-sm'
                  : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]',
                'focus-within:ring-2 focus-within:ring-bnb/60 focus-within:ring-offset-2 focus-within:ring-offset-ink',
              )}
            >
              <input
                type="radio"
                name={name}
                value={tier.id}
                checked={selected}
                onChange={() => onChange(tier.id)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                  selected ? 'border-bnb bg-bnb text-ink' : 'border-white/20 bg-transparent',
                )}
              >
                {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className={cn('text-sm font-semibold', selected ? 'text-white' : 'text-slate-200')}>
                    {tier.name}
                  </span>
                  {tier.recommended && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-bnb/30 bg-bnb/10 px-1.5 py-0.5 text-[10px] font-medium text-bnb">
                      <Sparkles className="h-2.5 w-2.5" aria-hidden />
                      Recommended
                    </span>
                  )}
                  <span className="tabular ml-auto whitespace-nowrap text-sm font-semibold text-white">
                    {formatToken(tier.price, tier.currency)}
                    <span className="ml-1 text-[11px] font-normal text-slate-500">{periodLabel(tier.period)}</span>
                  </span>
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-slate-400">{tier.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
