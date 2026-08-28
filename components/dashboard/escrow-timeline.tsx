import { Check, RotateCcw, TriangleAlert } from '@/components/ui/icons';
import type { JobState } from '@/lib/jobs/lifecycle';
import { cn } from '@/lib/utils';

/**
 * The ERC-8183 job lifecycle, as the AgenticCommerce kernel actually models it.
 *
 * `created` and `funded` are separate on purpose: opening a job and locking its
 * budget are two distinct calls, and a job can sit unfunded. Evaluation is a
 * single node because accept and reject are the same step with two verdicts.
 */
export const JOB_LIFECYCLE = [
  {
    id: 'created',
    title: 'Job created',
    description: 'The client opens a job against the agent on the AgenticCommerce kernel.',
  },
  {
    id: 'funded',
    title: 'Funded',
    description: 'The job budget is locked in the kernel until the job settles.',
  },
  {
    id: 'submitted',
    title: 'Work submitted',
    description: 'The agent submits its deliverable reference on chain.',
  },
  {
    id: 'evaluated',
    title: 'Evaluated',
    description: 'The evaluator router accepts or rejects the submitted work.',
  },
  {
    id: 'settled',
    title: 'Settled',
    description: 'Payment is released to the agent, or the client claims a refund.',
  },
] as const;

export type StepState = 'done' | 'current' | 'upcoming' | 'failed' | 'refunded';
type StepId = (typeof JOB_LIFECYCLE)[number]['id'];

export interface TimelineStep {
  id: StepId;
  title: string;
  description: string;
  state: StepState;
  /** State-specific caption shown instead of the generic description. */
  caption?: string;
}

function progressTo(currentIdx: number): StepState[] {
  return JOB_LIFECYCLE.map((_, i): StepState => (i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming'));
}

/** Map an ERC-8183 job state onto the five lifecycle nodes. */
export function deriveJobTimeline(state: JobState): TimelineStep[] {
  let states: StepState[];
  const captions: Partial<Record<StepId, string>> = {};

  switch (state) {
    case 'created':
      states = progressTo(1);
      captions.created = 'Job opened on the kernel';
      captions.funded = 'Awaiting the client deposit';
      break;
    case 'funded':
      states = progressTo(2);
      captions.funded = 'Budget locked in escrow';
      captions.submitted = 'Agent is working on the task';
      break;
    case 'submitted':
      states = progressTo(3);
      captions.submitted = 'Deliverable reference submitted';
      captions.evaluated = 'Awaiting the evaluator router';
      break;
    case 'completed':
      states = progressTo(4);
      captions.evaluated = 'Evaluator accepted the work';
      captions.settled = 'Payment is releasable';
      break;
    case 'rejected':
      states = ['done', 'done', 'done', 'failed', 'upcoming'];
      captions.evaluated = 'Evaluator rejected the work';
      captions.settled = 'The client can claim a refund';
      break;
    case 'refunded':
      states = ['done', 'done', 'done', 'failed', 'refunded'];
      captions.evaluated = 'Evaluator rejected the work';
      captions.settled = 'Refund claimed by the client';
      break;
    case 'released':
    default:
      states = JOB_LIFECYCLE.map((): StepState => 'done');
      captions.evaluated = 'Evaluator accepted the work';
      captions.settled = 'Payment released to the agent';
      break;
  }

  return JOB_LIFECYCLE.map((step, i) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    state: states[i],
    caption: captions[step.id],
  }));
}

/** The lifecycle node a job has actually reached, for the compact rail. */
const STATE_NODE: Record<JobState, number> = {
  created: 0,
  funded: 1,
  submitted: 2,
  completed: 3,
  rejected: 3,
  released: 4,
  refunded: 4,
};

export function lifecycleIndex(state: JobState): number {
  return STATE_NODE[state];
}

const DOT: Record<StepState, string> = {
  done: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300',
  current: 'border-bnb/60 bg-bnb/15 text-bnb',
  upcoming: 'border-white/10 bg-white/[0.03] text-slate-600',
  failed: 'border-rose-400/40 bg-rose-400/15 text-rose-300',
  refunded: 'border-violet-400/40 bg-violet-400/15 text-violet-300',
};

const CAPTION: Record<StepState, string> = {
  done: 'text-slate-400',
  current: 'text-bnb-200',
  upcoming: 'text-slate-600',
  failed: 'text-rose-300',
  refunded: 'text-violet-300',
};

const STATE_LABEL: Record<StepState, string> = {
  done: 'completed',
  current: 'in progress',
  upcoming: 'upcoming',
  failed: 'rejected',
  refunded: 'refunded',
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

/** Full five-node lifecycle rail, used inside a job's expanded panel. */
export function JobLifecycle({ state, className }: { state: JobState; className?: string }) {
  const steps = deriveJobTimeline(state);
  return (
    <ol className={cn('grid gap-4 sm:grid-cols-5 sm:gap-3', className)} aria-label="ERC-8183 job lifecycle">
      {steps.map((step, i) => {
        const next = steps[i + 1];
        const lineLit = step.state === 'done' && !!next && next.state !== 'upcoming';
        const lineFailed = lineLit && next.state === 'failed';
        const lineRefunded = lineLit && next.state === 'refunded';
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
                  lineFailed
                    ? 'bg-rose-400/40'
                    : lineRefunded
                      ? 'bg-violet-400/40'
                      : lineLit
                        ? 'bg-emerald-400/40'
                        : 'bg-white/[0.08]',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                DOT[step.state],
              )}
            >
              {step.state === 'current' && (
                <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full border border-bnb/50" />
              )}
              <StepGlyph state={step.state} />
            </span>
            <div className="min-w-0">
              <p className={cn('text-xs font-medium', step.state === 'upcoming' ? 'text-slate-500' : 'text-white')}>
                {step.title}
                <span className="sr-only"> - {STATE_LABEL[step.state]}</span>
              </p>
              <p className={cn('mt-0.5 text-[11px] leading-snug', CAPTION[step.state])}>
                {step.caption ?? step.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Compact five-dot rail for the ledger table. It shows the job's position in
 * the lifecycle - a state machine, not a metric. It deliberately replaces the
 * old SLA progress bar, which had no onchain source.
 */
export function LifecycleRail({ state, className }: { state: JobState; className?: string }) {
  const steps = deriveJobTimeline(state);
  const idx = lifecycleIndex(state);
  const label = `${JOB_LIFECYCLE[idx].title} - step ${idx + 1} of ${JOB_LIFECYCLE.length}`;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex items-center gap-1" role="img" aria-label={label} title={label}>
        {steps.map((step) => (
          <span
            key={step.id}
            aria-hidden
            className={cn(
              'h-1.5 rounded-full transition-colors',
              step.state === 'upcoming' ? 'w-1.5 bg-white/15' : 'w-4',
              step.state === 'done' && 'bg-emerald-400/70',
              step.state === 'current' && 'bg-bnb',
              step.state === 'failed' && 'bg-rose-400',
              step.state === 'refunded' && 'bg-violet-400',
            )}
          />
        ))}
      </span>
      <span className="shrink-0 font-mono text-[11px] tabular text-slate-500">
        {idx + 1}/{JOB_LIFECYCLE.length}
      </span>
    </div>
  );
}
