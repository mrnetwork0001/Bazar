/**
 * The public projection of a real ERC-8183 job.
 *
 * Everything in here comes off the AgenticCommerce kernel through
 * `lib/jobs/read.ts` - there is no fixture, no cached copy and no placeholder.
 * If the chain cannot be reached the caller gets a typed failure instead of a
 * job-shaped object with blanks in it.
 *
 * Two rules this module exists to enforce:
 *
 *   1. "The kernel has no such job" and "Bazar could not reach the kernel" are
 *      different facts. They map to different HTTP statuses and are never
 *      collapsed.
 *   2. Expiry is judged against the chain's own head-block timestamp. When that
 *      read fails, `chainTime` is null and every clock-dependent field is null
 *      too - Bazar does not substitute a server clock and call it onchain.
 */
import {
  DEFAULT_CHAIN_ID,
  getDeployment,
  type SupportedChainId,
} from '@/lib/chain/addresses';
import {
  describeRpc,
  readChainTime,
  type ChainReadError,
  type ChainReadFailure,
} from '@/lib/chain/client';
import { canClaimRefund, isExpiredAt } from '@/lib/chain/job-status';
import { AGENTIC_COMMERCE_FUNCTION_SIGNATURES } from '@/lib/abi';
import { holdsEscrow, isSettled, JOB_STATUS_META, lifecycleIndex } from '@/lib/jobs/lifecycle';
import {
  formatBudget,
  PAYMENT_TOKEN_DECIMALS,
  PAYMENT_TOKEN_SYMBOL,
  readJobResult,
  readPaymentToken,
  type OnchainJob,
} from '@/lib/jobs/read';
import type { Address } from '@/lib/types';
import { bscScanAddress } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface JobBudgetView {
  /** Base units, exactly as the kernel stores it. Decimal string, never a JS number. */
  raw: string;
  /** Whole token units, full precision, never rounded. e.g. "0.1". */
  formatted: string;
  /** Ready to print. e.g. "0.1 U". Never says BNB - budgets are ERC-20, not native. */
  label: string;
  token: Address;
  symbol: string;
  decimals: number;
  /**
   * True when `symbol` and `decimals` were read off the token in this request.
   * False means the read failed and Bazar used the values it has verified on
   * both chains ("U" / 18) - stated rather than passed off as a live read.
   */
  tokenVerifiedInThisResponse: boolean;
  explorer: string;
}

export interface JobChainTimeView {
  /** Head-block timestamp, unix seconds. The value the kernel compares against. */
  blockTimestamp: number;
  blockNumber: string;
  /** `expiredAt <= block.timestamp`. */
  expired: boolean;
  /** Negative once the expiry has passed. */
  secondsUntilExpiry: number;
}

export interface JobView {
  standard: 'ERC-8183';
  chainId: SupportedChainId;
  chainName: string;
  kernel: Address;
  jobId: string;

  status: OnchainJob['status'];
  /** The raw uint8 in the tuple, so an unrecognised value is still reportable. */
  statusRaw: number;
  statusLabel: string;
  statusMeaning: string;
  /** Index into the five-node lifecycle rail, or -1 for an unrecognised status. */
  lifecycleIndex: number;
  terminal: boolean;
  /** True while the kernel is holding the budget: FUNDED or SUBMITTED. */
  escrowHeld: boolean;

  client: Address;
  provider: Address;
  evaluator: Address;
  hook: Address;
  description: string;
  budget: JobBudgetView;

  expiredAt: number;
  expiredAtIso: string;
  submittedAt: number;
  submittedAtIso: string | null;
  submitted: boolean;
  deliverable: string;

  /** Null when the head block could not be read; every field below it is null too. */
  chainTime: JobChainTimeView | null;
  /** Null when `chainTime` is null - Bazar will not guess at expiry. */
  expired: boolean | null;
  /** Null when `chainTime` is null. `claimRefund(jobId)` would be accepted. */
  refundClaimable: boolean | null;

  explorer: {
    kernel: string;
    client: string;
    provider: string;
    evaluator: string;
    token: string;
  };
}

export interface JobViewEnvelope {
  ok: true;
  job: JobView;
  source: {
    /** The exact call behind every field above. */
    read: string;
    contract: Address;
    /** Host only - never the full RPC URL, which may carry a key. */
    rpcHost: string;
    note: string;
  };
  settlement: {
    /**
     * Bazar reads this job when you ask for it and runs no background listener,
     * so there is no push, no webhook and no cached lifecycle. Poll this route.
     */
    observation: 'read-on-request';
    listener: false;
    note: string;
  };
}

/** Why a job read did not produce a job, in the router's own vocabulary. */
export type JobViewFailureCode = 'JOB_NOT_FOUND' | 'CHAIN_UNAVAILABLE' | 'CHAIN_READ_FAILED';

export interface JobViewFailure {
  ok: false;
  /** 404, 502 or 503 - never collapsed into one. */
  status: 404 | 502 | 503;
  code: JobViewFailureCode;
  message: string;
  details: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Unix seconds -> ISO. A pure conversion of a chain value, not a clock read. */
function isoFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

/**
 * Maps a `ChainReadFailure` onto HTTP. The three outcomes stay separate on
 * purpose: an agent that retries a 503 forever on a 404 will never make
 * progress, and one that gives up on a 404 when the RPC merely hiccuped will
 * report a real job as nonexistent.
 */
export function failureToHttp(
  failure: ChainReadFailure,
): { status: 404 | 502 | 503; code: JobViewFailureCode } {
  switch (failure) {
    case 'not-found':
      return { status: 404, code: 'JOB_NOT_FOUND' };
    case 'call-failed':
      return { status: 502, code: 'CHAIN_READ_FAILED' };
    case 'rpc-refused':
    case 'rpc-unreachable':
    default:
      return { status: 503, code: 'CHAIN_UNAVAILABLE' };
  }
}

const NOT_FOUND_NOTE =
  'The kernel answered. getJob returns an all-zero tuple for an id it has never issued, which is how Bazar tells "no such job" apart from "no answer" - so this is the chain saying the job does not exist, not Bazar failing to look.';

const UNAVAILABLE_NOTE =
  'Bazar could not read the AgenticCommerce kernel, so it cannot say whether this job exists. This is not a 404: retry rather than concluding the job is absent.';

/**
 * Renders a read failure as the exact body the route returns. Exported so the
 * developers page documents the real envelope rather than a transcription of it.
 */
export function jobReadFailure(
  chainId: SupportedChainId,
  jobId: bigint,
  error: ChainReadError,
): JobViewFailure {
  const { status, code } = failureToHttp(error.failure);
  const deployment = getDeployment(chainId);
  return {
    ok: false,
    status,
    code,
    message: status === 404 ? `${error.message} ${NOT_FOUND_NOTE}` : `${error.message} ${UNAVAILABLE_NOTE}`,
    details: {
      jobId: jobId.toString(),
      chainId,
      kernel: deployment.agenticCommerce,
      failure: error.failure,
      rpcHost: hostOf(describeRpc(chainId).calls),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Projection                                                          */
/* ------------------------------------------------------------------ */

export interface TokenMetaInput {
  symbol: string;
  decimals: number;
  verified: boolean;
}

/**
 * Pure projection of a live job onto the wire shape. Kept separate from the
 * fetch so the developers page can render the exact body the route returns for
 * a job it already read.
 */
export function toJobView(
  job: OnchainJob,
  token: TokenMetaInput,
  chainTime: { value: number; blockNumber: bigint } | null,
): JobView {
  const deployment = getDeployment(job.chainId);
  const meta = JOB_STATUS_META[job.status];
  const formatted = formatBudget(job.budget, token.decimals);

  const expired = chainTime ? isExpiredAt(job.expiredAt, chainTime.value) : null;
  const refundClaimable = chainTime
    ? canClaimRefund(job.status, job.expiredAt, chainTime.value)
    : null;

  return {
    standard: 'ERC-8183',
    chainId: job.chainId,
    chainName: deployment.name,
    kernel: deployment.agenticCommerce,
    jobId: job.id.toString(),

    status: job.status,
    statusRaw: job.statusRaw,
    statusLabel: meta.label,
    statusMeaning: meta.description,
    lifecycleIndex: lifecycleIndex(job.status),
    terminal: isSettled(job.status),
    escrowHeld: holdsEscrow(job.status),

    client: job.client,
    provider: job.provider,
    evaluator: job.evaluator,
    hook: job.hook,
    description: job.description,
    budget: {
      raw: job.budget.toString(),
      formatted,
      label: `${formatted} ${token.symbol}`,
      token: deployment.paymentToken,
      symbol: token.symbol,
      decimals: token.decimals,
      tokenVerifiedInThisResponse: token.verified,
      explorer: bscScanAddress(deployment.paymentToken, job.chainId),
    },

    expiredAt: job.expiredAt,
    expiredAtIso: isoFromUnix(job.expiredAt),
    submittedAt: job.submittedAt,
    submittedAtIso: job.submittedAt > 0 ? isoFromUnix(job.submittedAt) : null,
    submitted: job.submittedAt > 0,
    deliverable: job.deliverable,

    chainTime: chainTime
      ? {
          blockTimestamp: chainTime.value,
          blockNumber: chainTime.blockNumber.toString(),
          expired: expired ?? false,
          secondsUntilExpiry: job.expiredAt - chainTime.value,
        }
      : null,
    expired,
    refundClaimable,

    explorer: {
      kernel: `${bscScanAddress(deployment.agenticCommerce, job.chainId)}#code`,
      client: bscScanAddress(job.client, job.chainId),
      provider: bscScanAddress(job.provider, job.chainId),
      evaluator: bscScanAddress(job.evaluator, job.chainId),
      token: bscScanAddress(deployment.paymentToken, job.chainId),
    },
  };
}

const SETTLEMENT_NOTE =
  'This body is a live getJob read performed while answering this request. Bazar runs no ERC-8183 log listener, keeps no job database and pushes no updates: to follow a job, poll this route. The kernel remains the authority - every field here is one getJob call away from being checked directly.';

const SOURCE_NOTE =
  'Read straight off the AgenticCommerce kernel with eth_call. Nothing here is cached, indexed or reconstructed from events.';

export function toJobEnvelope(view: JobView): JobViewEnvelope {
  return {
    ok: true,
    job: view,
    source: {
      read: AGENTIC_COMMERCE_FUNCTION_SIGNATURES.getJob,
      contract: view.kernel,
      rpcHost: hostOf(describeRpc(view.chainId).calls),
      note: SOURCE_NOTE,
    },
    settlement: {
      observation: 'read-on-request',
      listener: false,
      note: SETTLEMENT_NOTE,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

/**
 * Read one job and project it, or explain precisely why it could not.
 *
 * The token metadata and the head block are read alongside the job. Neither is
 * allowed to fail the request: a job that reads fine is still worth returning
 * when the token symbol read times out, so long as the response admits which
 * values were verified in this round trip.
 */
export async function fetchJobView(
  chainId: SupportedChainId,
  jobId: bigint,
): Promise<JobViewEnvelope | JobViewFailure> {
  const [jobResult, tokenResult, timeResult] = await Promise.all([
    readJobResult(chainId, jobId),
    readPaymentToken(chainId),
    readChainTime(chainId),
  ]);

  if (!jobResult.ok) return jobReadFailure(chainId, jobId, jobResult);

  const token: TokenMetaInput = tokenResult.ok
    ? { symbol: tokenResult.token.symbol, decimals: tokenResult.token.decimals, verified: true }
    : { symbol: PAYMENT_TOKEN_SYMBOL, decimals: PAYMENT_TOKEN_DECIMALS, verified: false };

  const chainTime = timeResult.ok
    ? { value: timeResult.value, blockNumber: timeResult.blockNumber }
    : null;

  return toJobEnvelope(toJobView(jobResult.job, token, chainTime));
}

/* ------------------------------------------------------------------ */
/* Request parsing                                                     */
/* ------------------------------------------------------------------ */

export const SUPPORTED_JOB_CHAIN_IDS: readonly SupportedChainId[] = [56];

export type JobIdParse =
  | { ok: true; jobId: bigint }
  | { ok: false; message: string };

/**
 * Job ids are `uint256` and start at 1. They are parsed as BigInt rather than
 * Number because mainnet is already past 56,000 and a marketplace id has no
 * business round-tripping through a float.
 */
export function parseJobId(raw: string): JobIdParse {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) {
    return {
      ok: false,
      message: 'jobId must be a base-10 unsigned integer - the uint256 the kernel returned from createJob.',
    };
  }
  const value = BigInt(text);
  if (value <= 0n) {
    return { ok: false, message: 'Job ids start at 1; 0 is never a job.' };
  }
  return { ok: true, jobId: value };
}

export function parseJobChainId(raw: string | null): { ok: true; chainId: SupportedChainId } | { ok: false; message: string } {
  if (raw === null || raw.trim() === '') return { ok: true, chainId: DEFAULT_CHAIN_ID };
  const value = Number(raw);
  if (!SUPPORTED_JOB_CHAIN_IDS.includes(value as SupportedChainId)) {
    return {
      ok: false,
      message: `chainId must be 56 (BNB Smart Chain) or 97 (BSC Testnet). The kernel is deployed on both and nowhere else Bazar reads.`,
    };
  }
  return { ok: true, chainId: value as SupportedChainId };
}
