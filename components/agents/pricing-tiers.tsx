import { Check, Sparkles } from 'lucide-react';
import type { Agent } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { HireButton } from '@/components/hire/hire-button';
import { cn, formatToken, periodLabel } from '@/lib/utils';

export interface PricingTiersProps {
  agent: Agent;
  className?: string;
}

/**
 * The agent's three escrow-backed plans. The recommended tier is lifted in
 * gold; every card opens the hire flow pre-set to its own tier.
 */
export function PricingTiers({ agent, className }: PricingTiersProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-3', className)}>
      {agent.pricing.map((tier) => {
        const recommended = !!tier.recommended;
        return (
          <div
            key={tier.id}
            className={cn(
              'relative flex flex-col rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300',
              recommended
                ? 'border-bnb/40 bg-bnb/[0.06] shadow-glow-sm'
                : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]',
            )}
          >
            {recommended && (
              <div className="absolute -top-2.5 left-5">
                <Badge tone="gold" icon={<Sparkles className="h-3 w-3" aria-hidden />} className="bg-ink">
                  Recommended
                </Badge>
              </div>
            )}

            <h3 className={cn('text-sm font-semibold', recommended ? 'text-bnb' : 'text-white')}>{tier.name}</h3>

            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="tabular text-2xl font-semibold tracking-tight text-white">
                {formatToken(tier.price, tier.currency)}
              </span>
              <span className="text-xs text-slate-500">{periodLabel(tier.period)}</span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-400">{tier.description}</p>

            <ul className="mt-4 flex-1 space-y-2">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-xs leading-snug text-slate-300">
                  <Check
                    className={cn('mt-px h-3.5 w-3.5 shrink-0', recommended ? 'text-bnb' : 'text-emerald-400')}
                    aria-hidden
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <HireButton
              agent={agent}
              tierId={tier.id}
              variant={recommended ? 'primary' : 'secondary'}
              className="mt-5 w-full"
              label={`Hire · ${tier.name}`}
            />
          </div>
        );
      })}
    </div>
  );
}
