'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BSC_MAINNET, BSC_TESTNET, type SupportedChainId } from '@/lib/chain/addresses';
import { LOG_CHUNK_BLOCKS, readChainTime, type ChainReadFailure } from '@/lib/chain/client';
import {
  readJobsByIds,
  readJobsForClient,
  readKernelInfo,
  readPaymentTokenPosition,
  type KernelInfo,
  type OnchainJob,
  type PaymentTokenPosition,
} from '@/lib/jobs/read';
import type { Address } from '@/lib/types';

/**
 * Finding the connected wallet's jobs on the AgenticCommerce kernel.
 *
 * The kernel has no "jobs for this address" view function, so there are exactly
 * two ways to find them, and this hook runs BOTH because each one fails where
 * the other works.
 *
 *   1. RECENT-ID SWEEP. Read `jobCounter`, then `getJob` the last N ids through
 *      multicall3 and keep the ones whose `client` is this wallet. This uses
 *      the call RPC, which is reliable: measured 2026-08-28, 150 ids came back
 *      in ~5.4s on mainnet and ~4s on testnet, with zero failures. It is
 *      exhaustive within its id window, so a job created seconds ago is always
 *      in it - which is the case that matters right after a wallet funds one.
 *      It cannot see older jobs, because the window is the tail of the counter.
 *
 *   2. `JobCreated` LOG SCAN, filtered on the indexed `client` topic. This
 *      reaches back by block range rather than by id, so it finds old jobs the
 *      sweep cannot. It is also the unreliable one: on mainnet the only public
 *      host that serves `eth_getLogs` for this contract refused 51 of 56 range
 *      requests in a measured run. A scan that loses most of its chunks is not
 *      a list of "no jobs" - it is a list with holes, and the UI is required to
 *      say which.
 *
 * Results are merged by job id. Every job in `jobs` was read with `getJob`, so
 * the state shown is current rather than whatever it was at creation time.
 * Nothing here fabricates, caches across wallets, or fills a gap: if both
 * sources fail, `jobs` is empty AND both sources report why.
 */

/** How many trailing job ids the sweep reads at depth 0. */
const SWEEP_IDS_PER_DEPTH = 150;

/** Log chunks the scan is allowed at depth 0, per chain. */
const LOG_CHUNKS_PER_DEPTH: Record<SupportedChainId, number> = {
  [BSC_MAINNET]: 24,
  [BSC_TESTNET]: 12,
};

/** Widening the window is opt-in and bounded; a page load cannot issue hundreds of requests. */
export const MAX_SCAN_DEPTH = 3;

/** Cap on jobs returned by one log scan, mirroring the reader's own default. */
const LOG_LIMIT = 50;

export interface SweepReport {
  /** Highest job id the kernel has issued, at the moment of the sweep. */
  jobCounter: bigint;
  /** Lowest id read (inclusive). */
  fromId: bigint;
  /** Highest id read (inclusive). */
  toId: bigint;
  /** How many ids were actually read. */
  scanned: number;
  /** True when ids exist below `fromId` that this sweep did not look at. */
  truncated: boolean;
}

export interface LogReport {
  scannedFrom: bigint;
  scannedTo: bigint;
  truncated: boolean;
  chunksRequested: number;
  chunksFailed: number;
}

export type SourceState<T> =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'ok'; report: T; found: number }
  | { status: 'failed'; failure: ChainReadFailure; message: string };

export interface JobDiscovery {
  /** Every job found by either source, newest id first. */
  jobs: OnchainJob[];
  sweep: SourceState<SweepReport>;
  logs: SourceState<LogReport>;
  /** Head-block timestamp in seconds. Every expiry decision compares to this. */
  chainTime: number | null;
  kernel: KernelInfo | null;
  /** The wallet's settlement-token balance and its allowance to the kernel. */
  position: PaymentTokenPosition | null;
  depth: number;
  canScanDeeper: boolean;
  scanDeeper: () => void;
  refresh: () => void;
  /** True while either source is still running. */
  loading: boolean;
}

const IDLE: SourceState<never> = { status: 'idle' };

export function useJobDiscovery(
  chainId: SupportedChainId | null,
  address: Address | undefined,
): JobDiscovery {
  const [depth, setDepth] = useState(0);
  const [nonce, setNonce] = useState(0);

  const [sweepJobs, setSweepJobs] = useState<OnchainJob[]>([]);
  const [logJobs, setLogJobs] = useState<OnchainJob[]>([]);
  const [sweep, setSweep] = useState<SourceState<SweepReport>>(IDLE);
  const [logs, setLogs] = useState<SourceState<LogReport>>(IDLE);
  const [chainTime, setChainTime] = useState<number | null>(null);
  const [kernel, setKernel] = useState<KernelInfo | null>(null);
  const [position, setPosition] = useState<PaymentTokenPosition | null>(null);

  // Every async result carries the run it belongs to. A wallet or network
  // switch mid-scan must not paint the previous wallet's jobs.
  const run = useRef(0);

  // Depth resets when the wallet or the network changes: the window that was
  // widened for one address means nothing for the next.
  useEffect(() => {
    setDepth(0);
  }, [chainId, address]);

  useEffect(() => {
    run.current += 1;
    const ticket = run.current;
    const mine = () => run.current === ticket;

    setSweepJobs([]);
    setLogJobs([]);
    setChainTime(null);
    setKernel(null);
    setPosition(null);

    if (!chainId || !address) {
      setSweep(IDLE);
      setLogs(IDLE);
      return;
    }

    const wallet = address.toLowerCase();
    const isClient = (job: OnchainJob) => job.client.toLowerCase() === wallet;

    setSweep({ status: 'running' });
    setLogs({ status: 'running' });

    // Chain time first and on its own: an expiry rendered against a browser
    // clock is a different claim from one rendered against block.timestamp,
    // and only the second one matches what the kernel will enforce.
    void readChainTime(chainId).then((result) => {
      if (mine() && result.ok) setChainTime(result.value);
    });

    void readPaymentTokenPosition(chainId, address).then((result) => {
      if (mine() && result.ok) setPosition(result.position);
    });

    // Source 1: the recent-id sweep.
    void (async () => {
      const info = await readKernelInfo(chainId);
      if (!mine()) return;
      if (!info.ok) {
        setSweep({ status: 'failed', failure: info.failure, message: info.message });
        return;
      }
      setKernel(info.info);

      const counter = info.info.jobCounter;
      if (counter <= 0n) {
        setSweep({
          status: 'ok',
          report: { jobCounter: 0n, fromId: 0n, toId: 0n, scanned: 0, truncated: false },
          found: 0,
        });
        return;
      }

      const want = BigInt(SWEEP_IDS_PER_DEPTH * (depth + 1));
      const fromId = counter > want ? counter - want + 1n : 1n;
      const ids: bigint[] = [];
      for (let id = counter; id >= fromId; id -= 1n) ids.push(id);

      const read = await readJobsByIds(chainId, ids);
      if (!mine()) return;
      if (!read.ok) {
        setSweep({ status: 'failed', failure: read.failure, message: read.message });
        return;
      }
      const found = read.jobs.filter(isClient);
      setSweepJobs(found);
      setSweep({
        status: 'ok',
        report: {
          jobCounter: counter,
          fromId,
          toId: counter,
          scanned: ids.length,
          truncated: fromId > 1n,
        },
        found: found.length,
      });
    })();

    // Source 2: the JobCreated log scan.
    void (async () => {
      const maxChunks = LOG_CHUNKS_PER_DEPTH[chainId] * (depth + 1);
      const result = await readJobsForClient(chainId, address, {
        maxChunks,
        lookbackBlocks: LOG_CHUNK_BLOCKS[chainId] * maxChunks,
        limit: LOG_LIMIT,
      });
      if (!mine()) return;
      if (!result.ok) {
        setLogs({ status: 'failed', failure: result.failure, message: result.message });
        return;
      }
      setLogJobs(result.jobs);
      setLogs({
        status: 'ok',
        report: {
          scannedFrom: result.scannedFrom,
          scannedTo: result.scannedTo,
          truncated: result.truncated,
          chunksRequested: result.chunksRequested,
          chunksFailed: result.chunksFailed,
        },
        found: result.jobs.length,
      });
    })();
  }, [chainId, address, depth, nonce]);

  const jobs = useMemo(() => {
    const byId = new Map<string, OnchainJob>();
    for (const job of [...logJobs, ...sweepJobs]) byId.set(job.id.toString(), job);
    return [...byId.values()].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  }, [logJobs, sweepJobs]);

  const scanDeeper = useCallback(() => {
    setDepth((d) => Math.min(d + 1, MAX_SCAN_DEPTH));
  }, []);

  const refresh = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  return {
    jobs,
    sweep,
    logs,
    chainTime,
    kernel,
    position,
    depth,
    canScanDeeper: depth < MAX_SCAN_DEPTH,
    scanDeeper,
    refresh,
    loading: sweep.status === 'running' || logs.status === 'running',
  };
}
