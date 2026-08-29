/**
 * A local note of the jobs this browser created, so they can be found again.
 *
 * WHY THIS EXISTS. The chain is the source of truth and the dashboard reads it
 * (`readJobsForClient` in `lib/jobs/read.ts`). But that read walks `JobCreated`
 * logs, and the public BSC endpoints make that unreliable: the Binance dataseed
 * hosts refuse `eth_getLogs` outright, PublicNode caps the range and drops a
 * large fraction of consecutive requests, and the scan reports itself as
 * `truncated` when it runs out of range before it runs out of history. A job
 * funded ninety seconds ago can legitimately fail to appear.
 *
 * So this file records the ONE thing a log scan cannot reconstruct cheaply: the
 * job id. Everything else - status, budget, provider, deliverable - is read
 * back from `getJob` by whoever renders it. Nothing here is authoritative and
 * nothing here should ever be rendered as job state.
 *
 * WHAT THIS IS NOT. It is not a job store, not a cache of job contents, and not
 * a fallback that lets the UI show a job when the chain is unreachable. A
 * receipt whose `getJob` read fails must be reported as unreadable, never
 * rendered from these fields.
 *
 * INTEROP. `HIRE_RECEIPTS_STORAGE_KEY` is the contract. Any surface that wants
 * the ids this browser created reads that key, or calls `readHireReceipts()`.
 * Feed the ids into `readJobsByIds(chainId, ids)` and render what the chain
 * returns.
 */

import { BSC_MAINNET, BSC_TESTNET, type SupportedChainId } from '@/lib/chain/addresses';
import type { Address } from '@/lib/types';

/** localStorage key. Versioned, so a shape change cannot be read as the old one. */
export const HIRE_RECEIPTS_STORAGE_KEY = 'bazar.hire.receipts.v1';

/** Hard cap, oldest dropped first. A browser note, not an archive. */
const MAX_RECEIPTS = 60;

export interface HireReceipt {
  chainId: SupportedChainId;
  /** Decimal string - job ids are `uint256` and do not survive JSON as numbers. */
  jobId: string;
  /** The wallet that created the job, lowercased. It is the kernel's `client`. */
  client: string;
  /** The address the job pays, as resolved at creation time. */
  provider: string;
  /** Agent slug from the ERC-8004 index, so a receipt can link back. */
  agentSlug: string;
  agentName: string;
  /** Budget in the payment token's smallest unit, as a decimal string. */
  budgetWei: string;
  /** The `createJob` transaction. Always present - the receipt is written from it. */
  createTxHash: string;
  /** The later steps, each null until that step lands. */
  registerTxHash: string | null;
  budgetTxHash: string | null;
  approveTxHash: string | null;
  fundTxHash: string | null;
  /**
   * Block that mined `createJob`, as a decimal string.
   *
   * Recorded instead of a wall-clock time on purpose: it is a fact the chain
   * produced, it orders receipts correctly, and it keeps `Date.now()` out of a
   * path that renders.
   */
  createdAtBlock: string;
}

function isSupported(chainId: unknown): chainId is SupportedChainId {
  return chainId === BSC_MAINNET || chainId === BSC_TESTNET;
}

function isReceipt(value: unknown): value is HireReceipt {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    isSupported(r.chainId) &&
    typeof r.jobId === 'string' &&
    /^[0-9]+$/.test(r.jobId) &&
    typeof r.client === 'string' &&
    typeof r.provider === 'string' &&
    typeof r.agentSlug === 'string' &&
    typeof r.agentName === 'string' &&
    typeof r.budgetWei === 'string' &&
    typeof r.createTxHash === 'string' &&
    typeof r.createdAtBlock === 'string'
  );
}

/**
 * Every receipt this browser holds, newest first.
 *
 * Returns `[]` on any problem - unavailable storage, malformed JSON, a value
 * written by a different version. A broken note is not worth an exception, and
 * it is certainly not worth inventing a job.
 */
export function readHireReceipts(): HireReceipt[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HIRE_RECEIPTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReceipt);
  } catch {
    return [];
  }
}

function write(receipts: HireReceipt[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HIRE_RECEIPTS_STORAGE_KEY, JSON.stringify(receipts.slice(0, MAX_RECEIPTS)));
  } catch {
    // Private mode, quota, storage disabled. The job is on the chain either
    // way; losing the local note costs a lookup, not a job.
  }
}

function sameJob(a: { chainId: number; jobId: string }, b: { chainId: number; jobId: string }): boolean {
  return a.chainId === b.chainId && a.jobId === b.jobId;
}

/** Record a newly created job. Replaces any existing note for the same id. */
export function recordHireReceipt(receipt: HireReceipt): void {
  const existing = readHireReceipts().filter((r) => !sameJob(r, receipt));
  write([receipt, ...existing]);
}

/** Attach a later transaction hash to a receipt already on file. */
export function updateHireReceipt(
  chainId: SupportedChainId,
  jobId: string,
  patch: Partial<Pick<HireReceipt, 'registerTxHash' | 'budgetTxHash' | 'approveTxHash' | 'fundTxHash'>>,
): void {
  const all = readHireReceipts();
  const index = all.findIndex((r) => sameJob(r, { chainId, jobId }));
  if (index < 0) return;
  const next = [...all];
  next[index] = { ...all[index]!, ...patch };
  write(next);
}

/** Job ids this browser created on one chain, newest first. Feed to `readJobsByIds`. */
export function hireReceiptJobIds(chainId: SupportedChainId, client?: Address): bigint[] {
  const wanted = client?.toLowerCase();
  return readHireReceipts()
    .filter((r) => r.chainId === chainId && (!wanted || r.client.toLowerCase() === wanted))
    .map((r) => {
      try {
        return BigInt(r.jobId);
      } catch {
        return 0n;
      }
    })
    .filter((id) => id > 0n);
}
