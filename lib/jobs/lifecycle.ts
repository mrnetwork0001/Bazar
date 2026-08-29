/**
 * The ERC-8183 job lifecycle, in the vocabulary the kernel actually uses.
 *
 * This file used to hold a hand-written set of states - created / funded /
 * submitted / completed / rejected / released / refunded. Three of those were
 * wrong. `IACP.JobStatus` has exactly six members, `released` and `refunded`
 * are not among them, and the first one is OPEN, not "created". The enum and
 * the evidence for it live in `lib/chain/job-status.ts`; this file is the
 * presentation vocabulary layered on top and never disagrees with it.
 *
 * What happened to the three states that vanished:
 *   created  -> renamed `open`. Same state, the kernel's own name for it.
 *   released -> not a status. Payment release is an *event*
 *               (`PaymentReleased`) emitted inside the same transaction that
 *               moves a job to COMPLETED, so it is never observable as a
 *               distinct state.
 *   refunded -> not a status either. `Refunded` fires alongside `JobExpired`
 *               when the client claims back an expired escrow (observed on
 *               testnet job 696, both events in one block), which lands the job
 *               on EXPIRED.
 *
 * `unknown` is here because the kernel is a UUPS proxy: it can be upgraded to
 * emit a status this build has never seen. When that happens the UI says so
 * rather than picking the nearest plausible label.
 */

import {
  ACTIVE_JOB_STATUSES,
  ESCROWED_JOB_STATUSES,
  JOB_STATUS_BY_VALUE,
  JOB_STATUS_VALUE,
  TERMINAL_JOB_STATUSES,
  type JobStatus,
  type KnownJobStatus,
} from '@/lib/chain/job-status';

export type { JobStatus, KnownJobStatus } from '@/lib/chain/job-status';
export {
  ACTIVE_JOB_STATUSES,
  ESCROWED_JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  JOB_STATUS_BY_VALUE,
  JOB_STATUS_VALUE,
  canClaimRefund,
  decodeJobStatus,
  isExpiredAt,
  isTerminalJobStatus,
} from '@/lib/chain/job-status';

/**
 * Legacy alias. `JobState` was this module's name for the same idea before the
 * enum was measured; kept so existing imports keep compiling while the UI is
 * migrated to `JobStatus`.
 *
 * @deprecated Import `JobStatus` from `@/lib/chain/job-status`.
 */
export type JobState = JobStatus;

export type JobStateTone = 'gold' | 'cyan' | 'emerald' | 'violet' | 'rose' | 'slate' | 'sky';

export interface JobStatusMeta {
  label: string;
  tone: JobStateTone;
  description: string;
  /** The raw uint8 the kernel stores, or null for `unknown`. */
  value: number | null;
}

export const JOB_STATUS_META: Record<JobStatus, JobStatusMeta> = {
  open: {
    label: 'Open',
    tone: 'slate',
    description:
      'Job created on the kernel. A budget may already be set, but nothing is escrowed until the client calls fund.',
    value: JOB_STATUS_VALUE.open,
  },
  funded: {
    label: 'Funded',
    tone: 'gold',
    description: 'Budget locked in the AgenticCommerce kernel while the agent works.',
    value: JOB_STATUS_VALUE.funded,
  },
  submitted: {
    label: 'Submitted',
    tone: 'cyan',
    description: 'The agent submitted its deliverable hash. Awaiting the evaluator.',
    value: JOB_STATUS_VALUE.submitted,
  },
  completed: {
    label: 'Completed',
    tone: 'emerald',
    description: 'Evaluator accepted the deliverable and the escrow was released to the agent in the same transaction.',
    value: JOB_STATUS_VALUE.completed,
  },
  rejected: {
    label: 'Rejected',
    tone: 'rose',
    description:
      'The job was rejected - by the client while it was still open, or by the evaluator after a submission.',
    value: JOB_STATUS_VALUE.rejected,
  },
  expired: {
    label: 'Expired',
    tone: 'violet',
    description: 'The expiry passed with the budget still escrowed, and the client claimed it back.',
    value: JOB_STATUS_VALUE.expired,
  },
  unknown: {
    label: 'Unrecognised',
    tone: 'slate',
    description:
      'The kernel returned a status this build does not recognise. Read it directly with getJob(jobId) rather than trusting a label here.',
    value: null,
  },
};

/**
 * Legacy alias for `JOB_STATUS_META`.
 * @deprecated Use `JOB_STATUS_META`.
 */
export const JOB_STATE_META = JOB_STATUS_META;

/* ------------------------------------------------------------------ */
/* The rail                                                            */
/* ------------------------------------------------------------------ */

/**
 * The five nodes a job walks through, for the lifecycle rail. Kept separate
 * from the status enum because two statuses can share a node: completed,
 * rejected and expired are all "settled", they just settle differently.
 */
export const JOB_LIFECYCLE_NODES = [
  { id: 'open', title: 'Open', description: 'createJob writes the job and its evaluator, hook and expiry.' },
  { id: 'funded', title: 'Funded', description: 'setBudget then fund move the budget into kernel escrow.' },
  { id: 'submitted', title: 'Submitted', description: 'The agent submits a deliverable hash.' },
  { id: 'evaluated', title: 'Evaluated', description: 'The evaluator router completes or rejects the job.' },
  { id: 'settled', title: 'Settled', description: 'Escrow leaves the kernel - released, or claimed back.' },
] as const;

export type JobLifecycleNodeId = (typeof JOB_LIFECYCLE_NODES)[number]['id'];

/**
 * Which node a status has reached. `unknown` returns -1: no node may be
 * highlighted for a status Bazar cannot identify.
 */
const STATUS_NODE: Record<JobStatus, number> = {
  open: 0,
  funded: 1,
  submitted: 2,
  completed: 4,
  rejected: 4,
  expired: 4,
  unknown: -1,
};

export function lifecycleIndex(status: JobStatus): number {
  return STATUS_NODE[status];
}

/** Every status the kernel can return, in enum order, for filters and legends. */
export const ALL_JOB_STATUSES: readonly KnownJobStatus[] = JOB_STATUS_BY_VALUE;

export function isActiveJobStatus(status: JobStatus): boolean {
  return ACTIVE_JOB_STATUSES.has(status);
}

export function holdsEscrow(status: JobStatus): boolean {
  return ESCROWED_JOB_STATUSES.has(status);
}

export function isSettled(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.has(status);
}
