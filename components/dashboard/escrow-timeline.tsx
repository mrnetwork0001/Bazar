import { Check, RotateCcw, TriangleAlert } from '@/components/ui/icons';
import { JOB_LIFECYCLE_NODES, lifecycleIndex, type JobLifecycleNodeId, type JobStatus } from '@/lib/jobs/lifecycle';
import { cn } from '@/lib/utils';

/**
 * The lifecycle rail, rendered from a job's real `IACP.JobStatus`.
 *
 * The five nodes and the status -> node mapping both come from
 * `lib/jobs/lifecycle`; this file adds nothing to them. That matters because
 * the nodes are NOT the onchain enum: `open`, `funded` and `submitted` are
 * statuses, while `evaluated` and `settled` are the same terminal node reached
 * three different ways (completed, rejected, expired). Duplicating either list
 * here is how the rail and the chain come to disagree.
 *
 * The captions below are the only thing this module decides, and every one of
 * them is a statement about state the kernel actually reports. Nothing implies
 * a step happened without evidence - see `deriveJobTimeline` for the case that
 * matters most, `submitted` on a job whose `submittedAt` is 0.
 */

export type StepState = 'done' | 'current' | 'upcoming' | 'failed' | 'refunded';

export interface TimelineStep {
  id: JobLifecycleNodeId;
  title: string;
  description: string;
  state: StepState;
  /** State-specific caption shown instead of the generic description. */
  caption?: string;
}

function progressTo(currentIdx: number): StepState[] {
  return JOB_LIFECYCLE_NODES.map((_, i): StepState =>
    i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming',
  );
}

/**
 * Map an ERC-8183 job status onto the five lifecycle nodes.
 *
 * `rejected` deliberately does NOT mark the `submitted` node done. A job can be
 * rejected straight out of OPEN - that is the kernel's cancel-an-open-job path,
 * and 15 of 22 REJECTED jobs sampled onchain had `submittedAt == 0`. Lighting
 * the submission node for those would claim a deliverable that was never sent.
 * Callers that know `submittedAt` pass it so the node can be lit only when the
 * chain says something was actually submitted.
 */
export function deriveJobTimeline(status: JobStatus, submittedAt = 0): TimelineStep[] {
  let states: StepState[];
  const captions: Partial<Record<JobLifecycleNodeId, string>> = {};
  const didSubmit = submittedAt > 0;

  /**
   * Whether escrow was ever actually held.
   *
   * A terminal status alone cannot tell us: a REJECTED job may have been
   * cancelled straight out of OPEN, before any budget was locked. The one
   * sound inference is that submission requires FUNDED - the kernel's status
   * gate rejects `submit` on an open job - so a recorded `submittedAt` proves
   * the escrow was held. Without that proof the node stays `upcoming` rather
   * than claiming money moved, which is the honest reading of "we do not
   * know from this record".
   */
  const escrowWasHeld = didSubmit;

  switch (status) {
    case 'open':
      states = progressTo(1);
      captions.open = 'Job opened on the kernel';
      captions.funded = 'Awaiting the client deposit - nothing is escrowed yet';
      break;
    case 'funded':
      states = progressTo(2);
      captions.funded = 'Budget locked in kernel escrow';
      captions.submitted = 'No deliverable submitted yet';
      break;
    case 'submitted':
      states = progressTo(3);
      captions.submitted = 'Deliverable hash recorded onchain';
      captions.evaluated = 'Awaiting the evaluator router';
      break;
    // COMPLETED is the end of the line: the kernel emits PaymentReleased in the
    // same transaction that sets it, so there is no separate "released" status.
    case 'completed':
      states = JOB_LIFECYCLE_NODES.map((): StepState => 'done');
      captions.evaluated = 'Evaluator accepted the work';
      captions.settled = 'Escrow released to the provider in the same transaction';
      break;
    case 'rejected':
      // A job can be rejected while still OPEN - the client cancelling before
      // funding - so the funded node must reflect whether escrow was ever held
      // rather than assuming every rejection passed through funding.
      states = [
        'done',
        escrowWasHeld ? 'done' : 'upcoming',
        didSubmit ? 'done' : 'upcoming',
        'failed',
        'failed',
      ];
      captions.submitted = didSubmit ? 'Deliverable hash recorded onchain' : 'Rejected before any deliverable was sent';
      captions.evaluated = didSubmit ? 'Evaluator rejected the deliverable' : 'Cancelled by the client while still open';
      captions.settled = escrowWasHeld
        ? 'Escrow left the kernel; the job is closed'
        : 'Closed before any budget was locked';
      break;
    // EXPIRED is reached by claimRefund on an expired escrow: the kernel emits
    // Refunded and JobExpired together, so the job never sits on a "refunded"
    // status of its own.
    case 'expired':
      states = ['done', 'done', didSubmit ? 'done' : 'upcoming', 'upcoming', 'refunded'];
      captions.submitted = didSubmit ? 'Deliverable hash recorded onchain' : 'No deliverable was submitted';
      captions.evaluated = 'The expiry passed before the job was evaluated';
      captions.settled = 'Budget refunded to the client';
      break;
    case 'unknown':
    default:
      // The kernel returned a status this build cannot identify. Highlight
      // nothing rather than guessing at a position on the rail.
      states = JOB_LIFECYCLE_NODES.map((): StepState => 'upcoming');
      captions.settled = 'Unrecognised onchain status - read getJob(jobId) directly';
      break;
  }

  return JOB_LIFECYCLE_NODES.map((node, i) => ({
    id: node.id,
    title: node.title,
    description: node.description,
    state: states[i] ?? 'upcoming',
    caption: captions[node.id],
  }));
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
  upcoming: 'not reached',
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

export interface JobLifecycleProps {
  status: JobStatus;
  /** Unix seconds from `getJob`. 0 means nothing was ever submitted. */
  submittedAt?: number;
  className?: string;
}

/** Full five-node lifecycle rail, used inside a job's expanded panel. */
export function JobLifecycle({ status, submittedAt = 0, className }: JobLifecycleProps) {
  const steps = deriveJobTimeline(status, submittedAt);
  return (
    <ol className={cn('grid gap-4 sm:grid-cols-5 sm:gap-3', className)} aria-label="ERC-8183 job lifecycle">
      {steps.map((step, i) => {
        const next = steps[i + 1];
        const lineLit = step.state === 'done' && !!next && next.state !== 'upcoming';
        const lineFailed = lineLit && next?.state === 'failed';
        const lineRefunded = lineLit && next?.state === 'refunded';
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
 * Compact five-dot rail for a job row. It shows the job's position in the
 * lifecycle - a state machine, not a metric.
 *
 * A status this build cannot identify has no position on the rail
 * (`lifecycleIndex` returns -1), so the counter is omitted entirely rather than
 * rendering a made-up step number.
 */
export function LifecycleRail({
  status,
  submittedAt = 0,
  className,
}: {
  status: JobStatus;
  submittedAt?: number;
  className?: string;
}) {
  const steps = deriveJobTimeline(status, submittedAt);
  const idx = lifecycleIndex(status);
  const node = idx >= 0 ? JOB_LIFECYCLE_NODES[idx] : undefined;
  const label = node
    ? `${node.title} - step ${idx + 1} of ${JOB_LIFECYCLE_NODES.length}`
    : 'Unrecognised status - no position on the lifecycle';

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
        {node ? `${idx + 1}/${JOB_LIFECYCLE_NODES.length}` : '?/5'}
      </span>
    </div>
  );
}
