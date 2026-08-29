/**
 * Server-side (and client-safe) viem clients for the BNB Chain deployments
 * Bazar reads.
 *
 * One cached `PublicClient` per chain per role. Cached because a Next.js server
 * component tree can read the kernel several times in one render and there is
 * no reason to rebuild a transport each time; safe to import from server
 * components, route handlers and `'use client'` components alike, since every
 * RPC URL is a `NEXT_PUBLIC_` value.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE ARE TWO CLIENTS PER CHAIN
 *
 * Measured 2026-08-28 against every public BSC endpoint worth trying: the
 * Binance dataseed hosts - `bsc-dataseed.binance.org`, `defibit`, `ninicoin`,
 * `data-seed-prebsc-*`, `bsc-testnet-dataseed.bnbchain.org` - answer
 * `eth_getLogs` with "Request exceeds defined limit." for EVERY range, down to
 * a fifty-block window. This is not a range cap that chunking can work around:
 * those endpoints do not serve logs at all. They are perfectly good for
 * `eth_call` and `eth_getBlockByNumber`, which is what `.env.example` points at
 * and what the read path mostly needs.
 *
 * So `getPublicClient` uses the configured RPC (calls, multicall), and
 * `getLogClient` uses a separate endpoint that actually serves logs. The
 * defaults are PublicNode, which was the only public host that returned logs
 * for these contracts:
 *
 *   mainnet  bsc-rpc.publicnode.com          accepts ranges up to ~2,000 blocks
 *   testnet  bsc-testnet-rpc.publicnode.com  accepts ranges up to ~50,000 blocks
 *
 * PublicNode also rate-limits hard and fails a large fraction of consecutive
 * requests, which is precisely why every log scan in `lib/jobs/read.ts` is
 * chunked, retried and allowed to return a partial answer. Override either with
 * `NEXT_PUBLIC_BSC_LOGS_RPC_URL` / `NEXT_PUBLIC_BSC_TESTNET_LOGS_RPC_URL`; a
 * paid endpoint removes both the range cap and the failures.
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';

import { BSC_MAINNET, BSC_TESTNET, MULTICALL3, type SupportedChainId } from './addresses';

/* ------------------------------------------------------------------ */
/* RPC endpoints                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fallbacks used when the corresponding env var is unset. These are the same
 * hosts `.env.example` documents; they serve `eth_call` and multicall fine.
 */
const DEFAULT_CALL_RPC: Record<SupportedChainId, string> = {
  [BSC_MAINNET]: 'https://bsc-dataseed.binance.org',
};

/** The only public hosts observed to serve `eth_getLogs` for these contracts. */
const DEFAULT_LOG_RPC: Record<SupportedChainId, string> = {
  [BSC_MAINNET]: 'https://bsc-rpc.publicnode.com',
};

/**
 * Largest `eth_getLogs` window each default log endpoint accepted, measured by
 * bisection on 2026-08-28. Kept well under the observed ceiling.
 */
export const LOG_CHUNK_BLOCKS: Record<SupportedChainId, number> = {
  [BSC_MAINNET]: 1_800,
};

/**
 * `process.env.NEXT_PUBLIC_*` must be referenced as a literal member expression
 * for Next.js to inline it into the client bundle - no dynamic indexing.
 */
function callRpcUrl(chainId: SupportedChainId): string {
  const configured =
    chainId === BSC_MAINNET
      ? process.env.NEXT_PUBLIC_BSC_RPC_URL
      : process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL;
  return configured?.trim() || DEFAULT_CALL_RPC[chainId];
}

function logRpcUrl(chainId: SupportedChainId): string {
  const configured =
    chainId === BSC_MAINNET
      ? process.env.NEXT_PUBLIC_BSC_LOGS_RPC_URL
      : process.env.NEXT_PUBLIC_BSC_TESTNET_LOGS_RPC_URL;
  return configured?.trim() || DEFAULT_LOG_RPC[chainId];
}

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

const VIEM_CHAIN = {
  [BSC_MAINNET]: bsc,
} as const;

const callClients = new Map<SupportedChainId, PublicClient>();
const logClients = new Map<SupportedChainId, PublicClient>();

function build(chainId: SupportedChainId, url: string, batch: boolean): PublicClient {
  const chain = VIEM_CHAIN[chainId];
  return createPublicClient({
    chain: {
      ...chain,
      contracts: { ...chain.contracts, multicall3: { address: MULTICALL3 } },
    },
    transport: http(url, { timeout: 20_000, retryCount: 2, retryDelay: 300 }),
    // Coalesce concurrent reads into multicall3 aggregates. Off for the log
    // client, which never batches reads and whose host is rate-limit sensitive.
    batch: batch ? { multicall: { batchSize: 512, wait: 16 } } : undefined,
  }) as PublicClient;
}

/** Cached client for `eth_call` / multicall reads. Never use it for logs. */
export function getPublicClient(chainId: SupportedChainId): PublicClient {
  const hit = callClients.get(chainId);
  if (hit) return hit;
  const created = build(chainId, callRpcUrl(chainId), true);
  callClients.set(chainId, created);
  return created;
}

/** Cached client for `eth_getLogs`. See the note at the top of this file. */
export function getLogClient(chainId: SupportedChainId): PublicClient {
  const hit = logClients.get(chainId);
  if (hit) return hit;
  const created = build(chainId, logRpcUrl(chainId), false);
  logClients.set(chainId, created);
  return created;
}

/** What each client is actually pointed at, for the honest "how we read" UI. */
export function describeRpc(chainId: SupportedChainId): { calls: string; logs: string } {
  return { calls: callRpcUrl(chainId), logs: logRpcUrl(chainId) };
}

/* ------------------------------------------------------------------ */
/* Degraded reads                                                      */
/* ------------------------------------------------------------------ */

/**
 * Why a read did not produce data. Nothing in this layer throws: a page that
 * 500s because a public RPC hiccuped is worse than a page that says the chain
 * was unreachable.
 */
export type ChainReadFailure =
  /** Transport-level: timeout, DNS, 5xx, rate limit. */
  | 'rpc-unreachable'
  /** The node answered, but refused the request (range limits, method disabled). */
  | 'rpc-refused'
  /** The call reverted or returned something that did not decode. */
  | 'call-failed'
  /** The chain answered, and the answer is that this thing does not exist. */
  | 'not-found';

export interface ChainReadError {
  ok: false;
  failure: ChainReadFailure;
  /** Short, already-safe-to-render explanation. Never a raw stack. */
  message: string;
}

export type ChainReadResult<T> = ({ ok: true } & T) | ChainReadError;

const REFUSAL_PATTERNS = [
  'exceeds defined limit',
  'limit exceeded',
  'invalid parameters',
  'query returned more than',
  'response size exceeded',
  'method not found',
  'method not supported',
  'not available',
];

/** Classify a thrown transport/decode error without leaking internals. */
export function classifyChainError(error: unknown): ChainReadError {
  const raw = error instanceof Error ? `${error.message}` : String(error);
  const lower = raw.toLowerCase();

  if (REFUSAL_PATTERNS.some((p) => lower.includes(p))) {
    return { ok: false, failure: 'rpc-refused', message: 'The RPC endpoint refused this request.' };
  }
  if (lower.includes('reverted') || lower.includes('decode')) {
    return { ok: false, failure: 'call-failed', message: 'The contract call did not return readable data.' };
  }
  return { ok: false, failure: 'rpc-unreachable', message: 'The BNB Chain RPC endpoint could not be reached.' };
}

/** Run a read, returning a typed failure instead of throwing. */
export async function safeRead<T>(fn: () => Promise<T>): Promise<ChainReadResult<{ value: T }>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return classifyChainError(error);
  }
}

/**
 * The chain's own head-block timestamp, in seconds.
 *
 * Expiry is compared against `block.timestamp` by the kernel, so every "is this
 * expired" decision in Bazar uses this, not a browser clock and not
 * `Date.now()`. Returns a typed failure rather than throwing.
 */
export async function readChainTime(
  chainId: SupportedChainId,
): Promise<ChainReadResult<{ value: number; blockNumber: bigint }>> {
  try {
    const block = await getPublicClient(chainId).getBlock({ blockTag: 'latest' });
    return { ok: true, value: Number(block.timestamp), blockNumber: block.number ?? 0n };
  } catch (error) {
    return classifyChainError(error);
  }
}
