import { Check, RotateCcw, TriangleAlert } from 'lucide-react';
import { ESCROW_STEPS } from '@/lib/constants';
import type { HireStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

export type StepState = 'done' | 'current' | 'upcoming' | 'failed' | 'refunded';
type StepId = (typeof ESCROW_STEPS)[number]['id'];

export interface TimelineStep {
  id: StepId;
  title: string;
  description: string;
  state: StepState;
  /** Status-specific caption shown instead of the generic description */
  caption?: string;
}

function progressTo(currentIdx: number): StepState[] {
  return ESCROW_STEPS.map((_, i): StepState => (i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming'));
}

/** Map a hire status onto the five ESCROW_STEPS. */
export function deriveTimeline(status: HireStatus): TimelineStep[] {
  let states: StepState[];
  const captions: Partial<Record<StepId, string>> = {};

  switch (status) {
    case 'pending':
      states = progressTo(1);
      captions.select = 'Plan selected';
      captions.lock = 'Awaiting your deposit';
      break;
    case 'escrowed':
      states = progressTo(2);
      captions.lock = 'Funds locked on BSC';
      captions.work = 'Waiting for the agent to start';
      break;
    case 'active':
      states = progressTo(2);
      captions.lock = 'Funds locked on BSC';
      captions.work = 'In progress — telemetry streaming';
      break;
    case 'sla-check':
      states = progressTo(3);
      captions.work = 'Execution complete';
      captions.verify = 'Checking telemetry now';
      break;
    case 'disputed':
      states = ['done', 'done', 'done', 'failed', 'upcoming'];
      captions.verify = 'Under validator review';
      captions.release = 'Held until the dispute resolves';
      break;
    case 'refunded':
      states = ['done', 'done', 'done', 'failed', 'refunded'];
      captions.verify = 'SLA terms were missed';
      captions.release = 'Refunded to your wallet';
      break;
    case 'released':
    default:
      states = ESCROW_STEPS.map((): StepState => 'done');
      captions.verify = 'SLA met';
      captions.release = 'Paid out to the agent';
      break;
  }

  return ESCROW_STEPS.map((step, i) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    state: states[i],
    caption: captions[step.id],
  }));
}

const DOT: Record<StepState, string> = {
  done: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300',
  current: 'border-bnb/60 bg-bnb/15 text-bnb',
  upcoming: 'border-white/10 bg-white/[0.03] text-slate-600',
  failed: 'border-rose-400/40 bg-rose-400/15 text-rose-300',
  refunded: 'border-rose-400/40 bg-rose-400/15 text-rose-300',
};

const CAPTION: Record<StepState, string> = {
  done: 'text-slate-400',
  current: 'text-bnb-200',
  upcoming: 'text-slate-600',
  failed: 'text-rose-300',
  refunded: 'text-rose-300',
};

function StepGlyph({ state }: { state: StepState }) {
  switch (state) {
    case 'done':
      return <Check className="h-3.5 w-3.5" aria-hidden />;
    case 'failed':
      return <TriangleAlert className="h-3.5 w-3.5" aria-hidden />;
    case 'refunded':
      return <RotateCcw className="h-3.5 w-3.5" aria-hidden />;
    case 'current':
      return <span aria-hidden className="h-2 w-2 rounded-full bg-current" />;
    case 'upcoming':
    default:
      return <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />;
  }
}

const STATE_LABEL: Record<StepState, string> = {
  done: 'completed',
  current: 'in progress',
  upcoming: 'upcoming',
  failed: 'failed',
  refunded: 'refunded',
};

export function EscrowTimeline({ status, className }: { status: HireStatus; className?: string }) {
  const steps = deriveTimeline(status);
  return (
    <ol className={cn('grid gap-4 sm:grid-cols-5 sm:gap-3', className)} aria-label="Escrow progress">
      {steps.map((step, i) => {
        const next = steps[i + 1];
        const lineLit = step.state === 'done' && !!next && next.state !== 'upcoming';
        const lineRose = lineLit && (next.state === 'failed' || next.state === 'refunded');
        return (
          <li
            key={step.id}
            className="relative flex gap-3 sm:flex-col sm:gap-2.5"
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            {next && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[13px] top-8 h-[calc(100%-1rem)] w-px sm:left-8 sm:top-[13px] sm:h-px sm:w-[calc(100%-1.25rem)]',
                  lineRose ? 'bg-rose-400/40' : lineLit ? 'bg-emerald-400/40' : 'bg-white/[0.08]',
                )}
              />
            )}
            <span className={cn('relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', DOT[step.state])}>
              {step.state === 'current' && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full border border-bnb/50" />}
              <StepGlyph state={step.state} />
            </span>
            <div className="min-w-0">
              <p className={cn('text-xs font-medium', step.state === 'upcoming' ? 'text-slate-500' : 'text-white')}>
                {step.title}
                <span className="sr-only"> — {STATE_LABEL[step.state]}</span>
              </p>
              <p className={cn('mt-0.5 text-[11px] leading-snug', CAPTION[step.state])}>{step.caption ?? step.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
