import { Check } from 'lucide-react';
import { ESCROW_STEPS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export type EscrowStepId = (typeof ESCROW_STEPS)[number]['id'];

export interface EscrowStepperProps {
  /** The step currently in progress. Everything before it reads as done. */
  currentId: EscrowStepId;
  className?: string;
}

/**
 * Compact five-node rail for the escrow lifecycle defined in `ESCROW_STEPS`.
 * Shown inside the hire modal so the user can see how far the money travels
 * before it reaches the agent.
 */
export function EscrowStepper({ currentId, className }: EscrowStepperProps) {
  const currentIndex = Math.max(
    0,
    ESCROW_STEPS.findIndex((step) => step.id === currentId),
  );
  const current = ESCROW_STEPS[currentIndex];
  const lastIndex = ESCROW_STEPS.length - 1;

  return (
    <div className={cn('select-none', className)}>
      <ol className="grid grid-cols-5 gap-0.5" aria-label="Escrow progress">
        {ESCROW_STEPS.map((step, i) => {
          const done = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <li
              key={step.id}
              className="flex flex-col items-center gap-1.5"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className="flex w-full items-center" aria-hidden>
                <span className={cn('h-px flex-1', i === 0 ? 'bg-transparent' : done || isCurrent ? 'bg-bnb/50' : 'bg-white/10')} />
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold transition-colors duration-300',
                    done && 'border-bnb/50 bg-bnb text-ink',
                    isCurrent && 'border-bnb bg-bnb/15 text-bnb shadow-glow-sm',
                    !done && !isCurrent && 'border-white/[0.12] bg-white/[0.04] text-slate-500',
                  )}
                >
                  {done ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
                </span>
                <span className={cn('h-px flex-1', i === lastIndex ? 'bg-transparent' : done ? 'bg-bnb/50' : 'bg-white/10')} />
              </div>
              <span
                className={cn(
                  'hidden text-center text-[9px] font-medium leading-tight sm:block',
                  isCurrent ? 'text-bnb' : done ? 'text-slate-300' : 'text-slate-600',
                )}
              >
                {step.title}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-2 text-center text-[11px] leading-snug text-slate-500 sm:hidden">
        Step {currentIndex + 1} of {ESCROW_STEPS.length} · <span className="text-slate-300">{current.title}</span>
      </p>
      <p className="mt-2 hidden text-center text-[11px] leading-snug text-slate-500 sm:block">{current.description}</p>
    </div>
  );
}
