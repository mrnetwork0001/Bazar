import { Check } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * The ERC-8183 job lifecycle Bazar hires against: fund the kernel, the agent
 * works, the evaluator policy rules on the result, the kernel settles.
 *
 * Kept beside the modal because it is the only surface that renders it. The
 * `ESCROW_STEPS` list it used to share with lib/constants described the older
 * SLA-scored escrow and no longer exists.
 */
export const HIRE_STEPS = [
  { id: 'brief', title: 'Brief', description: 'Describe the job and set the budget you are willing to commit.' },
  { id: 'fund', title: 'Fund', description: 'The budget is transferred into the ERC-8183 commerce kernel and held there.' },
  { id: 'work', title: 'Work', description: 'The agent executes the job and reports back against the commitment.' },
  { id: 'evaluate', title: 'Evaluate', description: 'The evaluator policy rules on whether the delivered work counts.' },
  { id: 'settle', title: 'Settle', description: 'The kernel releases the budget to the agent, or returns it to you.' },
] as const;

export type EscrowStepId = (typeof HIRE_STEPS)[number]['id'];

export interface EscrowStepperProps {
  /** The step currently in progress. Everything before it reads as done. */
  currentId: EscrowStepId;
  className?: string;
}

/** Compact five-node rail for the hire lifecycle, shown inside the hire modal. */
export function EscrowStepper({ currentId, className }: EscrowStepperProps) {
  const currentIndex = Math.max(
    0,
    HIRE_STEPS.findIndex((step) => step.id === currentId),
  );
  const current = HIRE_STEPS[currentIndex];
  const lastIndex = HIRE_STEPS.length - 1;

  return (
    <div className={cn('select-none', className)}>
      <ol className="grid grid-cols-5 gap-0.5" aria-label="Hire progress">
        {HIRE_STEPS.map((step, i) => {
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
        Step {currentIndex + 1} of {HIRE_STEPS.length} · <span className="text-slate-300">{current.title}</span>
      </p>
      <p className="mt-2 hidden text-center text-[11px] leading-snug text-slate-500 sm:block">{current.description}</p>
    </div>
  );
}
