/**
 * `IACP.JobStatus` - the uint8 in slot 7 of the `getJob` tuple.
 *
 * DERIVED EMPIRICALLY, NOT GUESSED. Everything below was measured against the
 * live AgenticCommerce kernel on 2026-08-28: mainnet 56 (`jobCounter` 56,665)
 * and testnet 97 (`jobCounter` 726). Four independent lines of evidence agree.
 *
 * ---------------------------------------------------------------------------
 * EVIDENCE 1 - event sequences observed onchain, correlated with the status the
 * same job reports now. This is the decisive one: it watches real transitions.
 * Logs read from `bsc-testnet-rpc.publicnode.com` in chunked ranges.
 *
 *   jobs 711-713, 716-720, 726  JobCreated                            -> status 0
 *   jobs 722-725                JobCreated, BudgetSet (x1..x4)        -> status 0
 *   jobs 714, 715, 721          JobCreated, BudgetSet, JobFunded      -> status 1
 *   jobs 703, 708, 710          JobCreated, BudgetSet, JobFunded,
 *                               JobSubmitted, JobCompleted,
 *                               PaymentReleased                       -> status 3
 *   job  696                    Refunded + JobExpired (same block)    -> status 5
 *
 * Note what jobs 722-725 prove: `BudgetSet` does NOT advance the status, and it
 * can fire repeatedly. Only `JobFunded` moves a job off 0.
 *
 * ---------------------------------------------------------------------------
 * EVIDENCE 2 - the state machine, probed with `eth_call` against real jobs on
 * both chains, calling each mutator from the job's own client / provider /
 * evaluator address and reading back the revert selector. `WrongStatus()` means
 * the kernel's status gate rejected the call; anything else means it passed.
 * (Samples chosen with `expiredAt` in the future, because an elapsed expiry
 * independently trips `WrongStatus` on `submit`.)
 *
 *   status  fund         submit       complete     reject        claimRefund
 *   0       passes gate  WrongStatus  WrongStatus  client-only   WrongStatus
 *   1       WrongStatus  passes       WrongStatus  passes        expired only
 *   2       WrongStatus  WrongStatus  passes       passes        expired only
 *   3       WrongStatus  WrongStatus  WrongStatus  WrongStatus   WrongStatus
 *   4       WrongStatus  WrongStatus  WrongStatus  WrongStatus   WrongStatus
 *   5       WrongStatus  WrongStatus  WrongStatus  WrongStatus   WrongStatus
 *
 * So 0 accepts funding, 1 accepts submission, 2 accepts adjudication, and
 * 3/4/5 are terminal. On status 0 `reject` from the evaluator returns
 * `Unauthorized()` while the client may call it - that is the "cancel an open
 * job" path, and it is why REJECTED jobs exist that were never submitted.
 *
 * ---------------------------------------------------------------------------
 * EVIDENCE 3 - field invariants over 1,327 real jobs (601 sampled across the
 * whole of mainnet, all 726 on testnet). Held with zero exceptions:
 *
 *   status 0  submittedAt == 0 always (222/222). budget may be non-zero (60),
 *             because `setBudget` runs before `fund`.
 *   status 1  submittedAt == 0 always (227/227), budget > 0 in 218/227.
 *   status 2  submittedAt != 0 and deliverable != 0x00.. always (278/278).
 *   status 3  submittedAt != 0 and deliverable != 0x00.. always (562/562) -
 *             only reachable through `submit`, hence COMPLETED.
 *   status 4  submittedAt == 0 in 15 of 22 - reachable WITHOUT a submission,
 *             which completion and expiry-refund both preclude.
 *   status 5  budget > 0 in 16/16 AND `expiredAt` in the past in 16/16 -
 *             the funded-then-expired signature.
 *
 *   Across all 1,327: (submittedAt != 0) === (deliverable != 0x00..).
 *
 * ---------------------------------------------------------------------------
 * EVIDENCE 4 - the official SDK declares the same ordering, and declares it
 * order-dependent with the Solidity source: `bnbagent/erc8183/types.py`,
 * `class JobStatus(IntEnum)` = OPEN 0, FUNDED 1, SUBMITTED 2, COMPLETED 3,
 * REJECTED 4, EXPIRED 5. The ABI names the type `enum IACP.JobStatus`.
 *
 * ---------------------------------------------------------------------------
 * CONFIDENCE. 0, 1, 3 and 5 are pinned by directly observed transitions
 * (evidence 1). 2 is pinned by evidence 2 and 3 - it is the only status that
 * accepts `complete`, and it always carries a deliverable. 4 is the one value
 * with no directly observed `JobRejected` transition in the block ranges the
 * public RPCs would serve; it is identified by exclusion (every other enum
 * member is accounted for, `JobRejected` is the only unclaimed terminal event),
 * by evidence 3, and by the SDK declaration. That is strong, but it is one
 * notch weaker than the rest, and it is recorded here rather than smoothed over.
 *
 * Anything outside 0-5 maps to `unknown`. The kernel is a UUPS proxy and can be
 * upgraded underneath us, so a seventh status is a real possibility; the UI must
 * say "unrecognised" rather than pick a plausible-looking label.
 */

/** The six values `IACP.JobStatus` defines, plus an honest escape hatch. */
export type JobStatus = 'open' | 'funded' | 'submitted' | 'completed' | 'rejected' | 'expired' | 'unknown';

/** Raw uint8 -> name. Index is the onchain enum value. */
export const JOB_STATUS_BY_VALUE = ['open', 'funded', 'submitted', 'completed', 'rejected', 'expired'] as const;

export type KnownJobStatus = (typeof JOB_STATUS_BY_VALUE)[number];

/** Name -> raw uint8, for the write paths and for filtering. */
export const JOB_STATUS_VALUE: Record<KnownJobStatus, number> = {
  open: 0,
  funded: 1,
  submitted: 2,
  completed: 3,
  rejected: 4,
  expired: 5,
};

/**
 * Decode the uint8 the kernel returned. Never throws and never invents a label:
 * an unrecognised value becomes `'unknown'`, which the UI is required to render
 * as unrecognised.
 */
export function decodeJobStatus(raw: number): JobStatus {
  return JOB_STATUS_BY_VALUE[raw] ?? 'unknown';
}

/** Terminal: the kernel rejects every mutator from here (evidence 2). */
export const TERMINAL_JOB_STATUSES: ReadonlySet<JobStatus> = new Set<JobStatus>([
  'completed',
  'rejected',
  'expired',
]);

/** Still moving: the job can still change state. */
export const ACTIVE_JOB_STATUSES: ReadonlySet<JobStatus> = new Set<JobStatus>(['open', 'funded', 'submitted']);

/** Escrow is holding the budget: funded, and not yet paid out or refunded. */
export const ESCROWED_JOB_STATUSES: ReadonlySet<JobStatus> = new Set<JobStatus>(['funded', 'submitted']);

export function isTerminalJobStatus(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.has(status);
}

/**
 * True once the job's expiry has elapsed.
 *
 * Takes the reference time explicitly - callers pass the chain's own head-block
 * timestamp (see `readChainTime`) rather than a browser clock, because the
 * kernel compares against `block.timestamp` and nothing else.
 */
export function isExpiredAt(expiredAt: number, nowSeconds: number): boolean {
  return expiredAt > 0 && expiredAt <= nowSeconds;
}

/**
 * Whether the client may `claimRefund` right now, per evidence 2: the job must
 * hold escrow (FUNDED or SUBMITTED) and its expiry must have elapsed. An
 * unfunded OPEN job cannot be refunded - it is cancelled with `reject` instead.
 */
export function canClaimRefund(status: JobStatus, expiredAt: number, nowSeconds: number): boolean {
  return ESCROWED_JOB_STATUSES.has(status) && isExpiredAt(expiredAt, nowSeconds);
}
