/**
 * The ERC-8183 job lifecycle.
 *
 * This is the real state machine the AgenticCommerce kernel implements -
 * createJob -> fund -> submit -> complete/reject -> release/refund - kept as
 * shared vocabulary for the UI and, in Phase 2, for reading job state off
 * chain. It deliberately holds no job records: Bazar ships no demo ledger, so
 * until settlement is wired there is nothing to enumerate.
 */

export type JobState = 'created' | 'funded' | 'submitted' | 'completed' | 'rejected' | 'released' | 'refunded';

export type JobStateTone = 'gold' | 'cyan' | 'emerald' | 'violet' | 'rose' | 'slate' | 'sky';

export const JOB_STATE_META: Record<JobState, { label: string; tone: JobStateTone; description: string }> = {
  created: {
    label: 'Created',
    tone: 'slate',
    description: 'Job opened against the agent. The budget has not been locked yet.',
  },
  funded: {
    label: 'Funded',
    tone: 'gold',
    description: 'Budget locked in the AgenticCommerce kernel while the agent works.',
  },
  submitted: {
    label: 'Submitted',
    tone: 'cyan',
    description: 'Agent submitted its deliverable. Awaiting the evaluator.',
  },
  completed: {
    label: 'Completed',
    tone: 'sky',
    description: 'Evaluator accepted the deliverable. Payment is releasable.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'rose',
    description: 'Evaluator rejected the deliverable. The client can claim a refund.',
  },
  released: {
    label: 'Released',
    tone: 'emerald',
    description: 'Payment released from escrow to the agent.',
  },
  refunded: {
    label: 'Refunded',
    tone: 'violet',
    description: 'Refund claimed by the client and returned from escrow.',
  },
};

/** True once escrow has moved and the job can no longer change state. */
export const TERMINAL_JOB_STATES: ReadonlySet<JobState> = new Set<JobState>(['released', 'refunded']);

/** Job is open: created, funded or awaiting evaluation. */
export const OPEN_JOB_STATES: ReadonlySet<JobState> = new Set<JobState>(['created', 'funded', 'submitted']);

/** Work has been delivered and the job is waiting on evaluation or settlement. */
export const DELIVERED_JOB_STATES: ReadonlySet<JobState> = new Set<JobState>(['submitted', 'completed', 'rejected']);

/* ------------------------------------------------------------------ */
/* Demo records                                                       */
/* ------------------------------------------------------------------ */
