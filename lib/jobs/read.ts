/**
 * Reading real ERC-8183 jobs off the AgenticCommerce kernel.
 *
 * Everything here is a read of live chain state. There are no fixtures, no
 * sample jobs and no fallbacks that invent a record when the chain is
 * unreachable - a failed read returns a typed failure and the UI is expected to
 * say so. `readJob` is the only function that collapses that into `null`, and
 * `readJobResult` exists so callers that must distinguish "no such job" from
 * "the RPC is down" can.
 *
 * Reading is best-effort by nature. The public BSC endpoints cap or refuse
 * `eth_getLogs` (see the note in `lib/chain/client.ts`), so any address-scoped
 * listing reports exactly which block range it managed to scan and whether it
 * ran out of range before it ran out of history.
 */

import { formatUnits, getAddress, type Hex } from 'viem';

import { AGENTIC_COMMERCE_ABI, ERC20_ABI } from '@/lib/abi';
import { getDeployment, type SupportedChainId } from '@/lib/chain/addresses';
import {
  classifyChainError,
  getLogClient,
  getPublicClient,
  LOG_CHUNK_BLOCKS,
  type ChainReadError,
  type ChainReadResult,
} from '@/lib/chain/client';
import { decodeJobStatus, type JobStatus } from '@/lib/chain/job-status';
import type { Address } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * One job, exactly as `getJob(uint256)` returned it, plus the two derived
 * conveniences every caller needs (a formatted budget and a decoded status).
 *
 * Nothing is defaulted or filled in. `budgetFormatted` is a decimal string in
 * whole units of the payment token; the token is "United Stables" (symbol `U`,
 * 18 decimals) on both chains, and a budget is NEVER denominated in BNB.
 */
export interface OnchainJob {
  chainId: SupportedChainId;
  id: bigint;
  client: Address;
  provider: Address;
  evaluator: Address;
  description: string;
  budget: bigint;
  /** Decimal string, token units. e.g. "0.1". Pair it with `PAYMENT_TOKEN_SYMBOL`. */
  budgetFormatted: string;
  /** Unix seconds. Compare against the chain's head timestamp, not a browser clock. */
  expiredAt: number;
  status: JobStatus;
  /** The raw uint8, kept so an unrecognised status can be reported honestly. */
  statusRaw: number;
  /** Unix seconds, 0 until the provider submits. */
  submittedAt: number;
  deliverable: Hex;
  hook: Address;
}

/** Symbol of the token the kernel settles in, verified onchain on both chains. */
export const PAYMENT_TOKEN_SYMBOL = 'U';
export const PAYMENT_TOKEN_DECIMALS = 18;

export interface JobListResult {
  jobs: OnchainJob[];
  /** First block actually scanned. Below this, nothing was looked at. */
  scannedFrom: bigint;
  /** Last block actually scanned - the head at the time of the scan. */
  scannedTo: bigint;
  /**
   * True when the scan stopped at its lookback limit or lost chunks to the RPC,
   * so older jobs may exist that are not in `jobs`. The UI must not present a
   * truncated list as complete.
   */
  truncated: boolean;
  /** How many range requests were issued, and how many the endpoint refused. */
  chunksRequested: number;
  chunksFailed: number;
}

/* ------------------------------------------------------------------ */
/* Decoding                                                            */
/* ------------------------------------------------------------------ */

/** The tuple `getJob` returns, in ABI order. */
interface RawJob {
  id: bigint;
  client: Address;
  provider: Address;
  evaluator: Address;
  description: string;
  budget: bigint;
  expiredAt: bigint;
  status: number;
  hook: Address;
  submittedAt: bigint;
  deliverable: Hex;
}

function toOnchainJob(chainId: SupportedChainId, raw: RawJob): OnchainJob {
  return {
    chainId,
    id: raw.id,
    client: getAddress(raw.client),
    provider: getAddress(raw.provider),
    evaluator: getAddress(raw.evaluator),
    description: raw.description,
    budget: raw.budget,
    budgetFormatted: formatBudget(raw.budget),
    expiredAt: Number(raw.expiredAt),
    status: decodeJobStatus(raw.status),
    statusRaw: raw.status,
    submittedAt: Number(raw.submittedAt),
    deliverable: raw.deliverable,
    hook: getAddress(raw.hook),
  };
}

/**
 * Format a token amount for display. Trims trailing zeros but never rounds -
 * an escrow figure that has been quietly rounded is a lie about what was
 * locked, so the full precision is preserved when it is there.
 */
export function formatBudget(amount: bigint, decimals: number = PAYMENT_TOKEN_DECIMALS): string {
  const text = formatUnits(amount, decimals);
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

/** "0.1 U". Use everywhere a budget is rendered, so nothing says "BNB". */
export function formatBudgetLabel(amount: bigint, decimals: number = PAYMENT_TOKEN_DECIMALS): string {
  return `${formatBudget(amount, decimals)} ${PAYMENT_TOKEN_SYMBOL}`;
}

/**
 * A job id the kernel has never issued reads back as an all-zero tuple rather
 * than reverting, so "does this job exist" is `id != 0`. Job ids start at 1;
 * `jobCounter` is the highest issued id.
 */
function jobExists(raw: RawJob): boolean {
  return raw.id !== 0n;
}

/* ------------------------------------------------------------------ */
/* Single job                                                          */
/* ------------------------------------------------------------------ */

/**
 * Read one job. Distinguishes "no such job" from "the chain could not be
 * reached", which the UI needs in order to be honest about which it is.
 */
export async function readJobResult(
  chainId: SupportedChainId,
  jobId: bigint | number,
): Promise<ChainReadResult<{ job: OnchainJob }>> {
  const id = BigInt(jobId);
  if (id <= 0n) {
    return { ok: false, failure: 'not-found', message: `Job ids start at 1; ${id} is not one.` };
  }
  try {
    const raw = (await getPublicClient(chainId).readContract({
      address: getDeployment(chainId).agenticCommerce,
      abi: AGENTIC_COMMERCE_ABI,
      functionName: 'getJob',
      args: [id],
    })) as unknown as RawJob;

    if (!jobExists(raw)) {
      return { ok: false, failure: 'not-found', message: `Job #${id} has not been created on this chain.` };
    }
    return { ok: true, job: toOnchainJob(chainId, raw) };
  } catch (error) {
    return classifyChainError(error);
  }
}

/**
 * Read one job, or `null`.
 *
 * `null` deliberately conflates "not found" with "unreachable" - reach for
 * `readJobResult` when the difference matters, which on any surface that
 * renders a message it does.
 */
export async function readJob(chainId: SupportedChainId, jobId: bigint | number): Promise<OnchainJob | null> {
  const result = await readJobResult(chainId, jobId);
  return result.ok ? result.job : null;
}

/* ------------------------------------------------------------------ */
/* Batched reads                                                       */
/* ------------------------------------------------------------------ */

/**
 * Read a known list of job ids in one round trip via multicall3
 * (`0xcA11bde05977b3631167028862bE2a173976CA11`, same address on both chains).
 *
 * Ids the kernel has never issued come back in `missing` rather than as blank
 * rows.
 *
 * A failed entry inside the aggregate is NOT treated as a missing job. `getJob`
 * does not revert for an id the kernel never issued - it returns an all-zero
 * tuple (verified against mainnet id 999999999) - so the only way an entry can
 * fail is a transport or decode problem. Folding that into `missing` would have
 * the UI report "this job does not exist" every time an RPC hiccuped, which is
 * a lie about the chain. Any failed entry fails the whole read instead.
 */
export async function readJobsByIds(
  chainId: SupportedChainId,
  ids: readonly (bigint | number)[],
): Promise<ChainReadResult<{ jobs: OnchainJob[]; missing: bigint[] }>> {
  const wanted = [...new Set(ids.map((v) => BigInt(v)))].filter((v) => v > 0n);
  if (wanted.length === 0) return { ok: true, jobs: [], missing: [] };

  const kernel = getDeployment(chainId).agenticCommerce;
  const jobs: OnchainJob[] = [];
  const missing: bigint[] = [];

  // Multicall3 has a calldata/gas ceiling; 200 `getJob` calls per aggregate is
  // comfortably inside it even with long description strings.
  const BATCH = 200;
  try {
    for (let i = 0; i < wanted.length; i += BATCH) {
      const slice = wanted.slice(i, i + BATCH);
      const results = await getPublicClient(chainId).multicall({
        allowFailure: true,
        contracts: slice.map((id) => ({
          address: kernel,
          abi: AGENTIC_COMMERCE_ABI,
          functionName: 'getJob',
          args: [id],
        })),
      });
      for (let index = 0; index < results.length; index += 1) {
        const entry = results[index]!;
        const id = slice[index]!;
        if (entry.status !== 'success') throw entry.error;
        const raw = entry.result as unknown as RawJob;
        if (!jobExists(raw)) missing.push(id);
        else jobs.push(toOnchainJob(chainId, raw));
      }
    }
  } catch (error) {
    return classifyChainError(error);
  }

  jobs.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return { ok: true, jobs, missing };
}

/* ------------------------------------------------------------------ */
/* Jobs for a client address                                           */
/* ------------------------------------------------------------------ */

export interface ReadJobsForClientOptions {
  /**
   * How far back to scan, in blocks. Default 100,000 - roughly 21 hours of BSC
   * at the current ~0.75s block time. Raise it only with an RPC that will
   * actually serve the extra requests.
   */
  lookbackBlocks?: number;
  /** Per-request block window. Defaults to what the endpoint was measured to accept. */
  chunkBlocks?: number;
  /** Stop early once this many jobs have been found. */
  limit?: number;
  /** Ceiling on range requests, so one page load cannot issue hundreds. */
  maxChunks?: number;
}

/**
 * Jobs where `address` is the client, found through `JobCreated` logs.
 *
 * `client` and `provider` are both indexed on `JobCreated`, so the node filters
 * by topic and we never pull the whole event stream. The scan walks backwards
 * from the head in small windows: public BSC endpoints cap `eth_getLogs`
 * ranges (and the Binance dataseed hosts refuse the method outright), so a
 * wide-range request is guaranteed to fail. Chunks that fail are counted and
 * skipped, not thrown - a partial answer plus an honest `scannedFrom` and
 * `truncated` is worth more than an exception.
 *
 * Job ids collected from logs are then read with `getJob` so the returned state
 * is current rather than whatever it was at creation time.
 */
export async function readJobsForClient(
  chainId: SupportedChainId,
  address: Address,
  opts: ReadJobsForClientOptions = {},
): Promise<ChainReadResult<JobListResult>> {
  const chunkBlocks = BigInt(opts.chunkBlocks ?? LOG_CHUNK_BLOCKS[chainId]);
  const lookback = BigInt(opts.lookbackBlocks ?? 100_000);
  const maxChunks = opts.maxChunks ?? 64;
  const limit = opts.limit ?? 50;

  const logClient = getLogClient(chainId);
  const kernel = getDeployment(chainId).agenticCommerce;

  let head: bigint;
  try {
    head = await logClient.getBlockNumber();
  } catch (error) {
    return classifyChainError(error);
  }

  const floor = head > lookback ? head - lookback : 0n;
  const jobIds: bigint[] = [];
  let cursor = head;
  let chunksRequested = 0;
  let chunksFailed = 0;
  let lastError: ChainReadError | null = null;

  while (cursor > floor && chunksRequested < maxChunks && jobIds.length < limit) {
    const from = cursor - chunkBlocks + 1n > floor ? cursor - chunkBlocks + 1n : floor;
    chunksRequested += 1;
    try {
      const logs = await logClient.getContractEvents({
        address: kernel,
        abi: AGENTIC_COMMERCE_ABI,
        eventName: 'JobCreated',
        args: { client: address },
        fromBlock: from,
        toBlock: cursor,
      });
      for (const log of logs) {
        const id = log.args.jobId;
        if (typeof id === 'bigint') jobIds.push(id);
      }
    } catch (error) {
      chunksFailed += 1;
      lastError = classifyChainError(error);
    }
    cursor = from - 1n;
  }

  const scannedFrom = cursor < floor ? floor : cursor + 1n;

  // Every chunk failed and nothing was read: that is a failed read, not an
  // empty result. Claiming "no jobs" here would be a lie about the chain.
  if (chunksRequested > 0 && chunksFailed === chunksRequested && lastError) {
    return lastError;
  }

  const detailed = await readJobsByIds(chainId, jobIds.slice(0, limit));
  if (!detailed.ok) return detailed;

  return {
    ok: true,
    jobs: detailed.jobs,
    scannedFrom,
    scannedTo: head,
    truncated: scannedFrom > 0n || chunksFailed > 0 || jobIds.length > limit,
    chunksRequested,
    chunksFailed,
  };
}

/* ------------------------------------------------------------------ */
/* Kernel + payment token                                              */
/* ------------------------------------------------------------------ */

export interface KernelInfo {
  jobCounter: bigint;
  paused: boolean;
  /** Platform fee in basis points. Measured 0 on both chains on 2026-08-28. */
  platformFeeBP: bigint;
  paymentToken: Address;
}

/** Live kernel state. Used to bound job-id ranges and to gate the write flow. */
export async function readKernelInfo(
  chainId: SupportedChainId,
): Promise<ChainReadResult<{ info: KernelInfo }>> {
  const kernel = getDeployment(chainId).agenticCommerce;
  try {
    const [jobCounter, paused, platformFeeBP, paymentToken] = await Promise.all([
      getPublicClient(chainId).readContract({ address: kernel, abi: AGENTIC_COMMERCE_ABI, functionName: 'jobCounter' }),
      getPublicClient(chainId).readContract({ address: kernel, abi: AGENTIC_COMMERCE_ABI, functionName: 'paused' }),
      getPublicClient(chainId).readContract({
        address: kernel,
        abi: AGENTIC_COMMERCE_ABI,
        functionName: 'platformFeeBP',
      }),
      getPublicClient(chainId).readContract({
        address: kernel,
        abi: AGENTIC_COMMERCE_ABI,
        functionName: 'paymentToken',
      }),
    ]);
    return {
      ok: true,
      info: {
        jobCounter: jobCounter as bigint,
        paused: paused as boolean,
        platformFeeBP: platformFeeBP as bigint,
        paymentToken: getAddress(paymentToken as Address),
      },
    };
  } catch (error) {
    return classifyChainError(error);
  }
}

export interface PaymentTokenMeta {
  address: Address;
  symbol: string;
  decimals: number;
}

export interface PaymentTokenPosition extends PaymentTokenMeta {
  /** The wallet's token balance. */
  balance: bigint;
  /** How much of it the AgenticCommerce kernel is currently allowed to move. */
  allowance: bigint;
}

/**
 * Symbol and decimals of the token the kernel settles in, read from the token
 * itself rather than assumed. Both chains answered "United Stables" / `U` / 18
 * on 2026-08-28; this reads it live so a redeployment cannot make the UI lie.
 */
export async function readPaymentToken(
  chainId: SupportedChainId,
): Promise<ChainReadResult<{ token: PaymentTokenMeta }>> {
  const address = getDeployment(chainId).paymentToken;
  try {
    const [symbol, decimals] = await Promise.all([
      getPublicClient(chainId).readContract({ address, abi: ERC20_ABI, functionName: 'symbol' }),
      getPublicClient(chainId).readContract({ address, abi: ERC20_ABI, functionName: 'decimals' }),
    ]);
    return { ok: true, token: { address, symbol: symbol as string, decimals: Number(decimals) } };
  } catch (error) {
    return classifyChainError(error);
  }
}

/**
 * Everything the funding flow needs about one wallet: what it holds, and how
 * much the kernel may already move on its behalf.
 *
 * `fund` performs an ERC-20 `transferFrom`, so a client must `approve` the
 * kernel for at least the budget before it will succeed. Compare `allowance`
 * against the budget to decide whether an approval step is required.
 */
export async function readPaymentTokenPosition(
  chainId: SupportedChainId,
  owner: Address,
): Promise<ChainReadResult<{ position: PaymentTokenPosition }>> {
  const deployment = getDeployment(chainId);
  const address = deployment.paymentToken;
  try {
    const [symbol, decimals, balance, allowance] = await Promise.all([
      getPublicClient(chainId).readContract({ address, abi: ERC20_ABI, functionName: 'symbol' }),
      getPublicClient(chainId).readContract({ address, abi: ERC20_ABI, functionName: 'decimals' }),
      getPublicClient(chainId).readContract({ address, abi: ERC20_ABI, functionName: 'balanceOf', args: [owner] }),
      getPublicClient(chainId).readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner, deployment.agenticCommerce],
      }),
    ]);
    return {
      ok: true,
      position: {
        address,
        symbol: symbol as string,
        decimals: Number(decimals),
        balance: balance as bigint,
        allowance: allowance as bigint,
      },
    };
  } catch (error) {
    return classifyChainError(error);
  }
}
