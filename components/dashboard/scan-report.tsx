'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Loader2, Radar, ScanSearch, WifiOff } from '@/components/ui/icons';
import type { SupportedChainId } from '@/lib/chain/addresses';
import { describeRpc } from '@/lib/chain/client';
import { cn } from '@/lib/utils';

import { formatBlockCount } from './format';
import type { LogReport, SourceState, SweepReport } from './use-job-discovery';

/**
 * What was actually looked at.
 *
 * This panel exists because a job list read off a public RPC is never
 * self-evidently complete, and presenting a partial list as a complete one is
 * the specific dishonesty this page has to avoid. It reports each of the two
 * discovery sources separately, with the window it covered and the requests it
 * lost, so "no jobs found" can be read as what it is: no jobs found *in this
 * window*, by *these* two methods.
 *
 * The mainnet numbers are not hypothetical. Measured 2026-08-28 against the
 * only public host that serves `eth_getLogs` for the kernel, a 56-chunk scan
 * had 51 chunks refused. A page that quietly rendered that as an empty ledger
 * would be claiming the chain said something it never said.
 */

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function SourceHeading({
  icon,
  title,
  state,
}: {
  icon: React.ReactNode;
  title: string;
  state: SourceState<unknown>;
}) {
  const tone =
    state.status === 'failed' ? 'rose' : state.status === 'ok' ? 'emerald' : state.status === 'running' ? 'gold' : 'slate';
  const label =
    state.status === 'failed'
      ? 'Failed'
      : state.status === 'ok'
        ? `${state.found} found`
        : state.status === 'running'
          ? 'Scanning'
          : 'Idle';

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-xs font-medium text-white">
        <span className="text-slate-500" aria-hidden>
          {icon}
        </span>
        {title}
      </span>
      <Badge tone={tone}>
        {state.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
        {label}
      </Badge>
    </div>
  );
}

export interface ScanReportProps {
  chainId: SupportedChainId;
  sweep: SourceState<SweepReport>;
  logs: SourceState<LogReport>;
  depth: number;
  canScanDeeper: boolean;
  scanDeeper: () => void;
  loading: boolean;
  className?: string;
}

export function ScanReport({
  chainId,
  sweep,
  logs,
  depth,
  canScanDeeper,
  scanDeeper,
  loading,
  className,
}: ScanReportProps) {
  const rpc = describeRpc(chainId);
  const logsLossy = logs.status === 'ok' && logs.report.chunksFailed > 0;

  return (
    <GlassCard as="section" aria-labelledby="scan-heading" padded={false} className={cn('overflow-hidden', className)}>
      <div className="border-b border-white/[0.06] px-5 py-4">
        <h2 id="scan-heading" className="text-sm font-semibold text-white">
          What was scanned
        </h2>
        <p className="mt-0.5 text-xs leading-snug text-slate-500">
          The kernel has no &ldquo;jobs for this address&rdquo; view, so Bazar looks two ways. Neither is guaranteed
          complete, and both report their own window.
        </p>
      </div>

      <div className="divide-y divide-white/[0.06]">
        {/* Source 1 - recent job ids via multicall */}
        <div className="px-5 py-4">
          <SourceHeading icon={<ScanSearch className="h-3.5 w-3.5" />} title="Recent job ids" state={sweep} />
          <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-500">
            {sweep.status === 'ok' && sweep.report.scanned > 0 && (
              <p>
                Read <span className="tabular text-slate-400">{sweep.report.scanned.toLocaleString('en-US')}</span> job
                ids,{' '}
                <span className="tabular text-slate-400">
                  #{sweep.report.fromId.toString()}–#{sweep.report.toId.toString()}
                </span>
                , through multicall3. The kernel has issued{' '}
                <span className="tabular text-slate-400">{sweep.report.jobCounter.toLocaleString('en-US')}</span> job ids
                in total.
                {sweep.report.truncated && ' Ids below that range were not read.'}
              </p>
            )}
            {sweep.status === 'ok' && sweep.report.scanned === 0 && (
              <p>The kernel reports no job ids issued on this chain yet.</p>
            )}
            {sweep.status === 'running' && <p>Reading the tail of the job counter through multicall3…</p>}
            {sweep.status === 'failed' && (
              <p className="text-rose-300">
                {sweep.message} Nothing was read, so this is not evidence that the wallet has no jobs.
              </p>
            )}
            <p>
              via <span className="font-mono text-slate-400">{hostOf(rpc.calls)}</span>
            </p>
          </div>
        </div>

        {/* Source 2 - JobCreated logs */}
        <div className="px-5 py-4">
          <SourceHeading icon={<Radar className="h-3.5 w-3.5" />} title="JobCreated logs" state={logs} />
          <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-500">
            {logs.status === 'ok' && (
              <>
                <p>
                  Scanned blocks{' '}
                  <span className="tabular text-slate-400">
                    {logs.report.scannedFrom.toString()}–{logs.report.scannedTo.toString()}
                  </span>{' '}
                  ({formatBlockCount(logs.report.scannedTo - logs.report.scannedFrom + 1n)} blocks), filtered on the
                  indexed <span className="font-mono">client</span> topic.
                </p>
                {logsLossy ? (
                  <p className="text-amber-300">
                    The endpoint refused{' '}
                    <span className="tabular">
                      {logs.report.chunksFailed} of {logs.report.chunksRequested}
                    </span>{' '}
                    range requests, so this scan has holes in it. Jobs created in a refused range are missing from the
                    list unless the id sweep above also caught them.
                  </p>
                ) : (
                  <p>
                    All <span className="tabular">{logs.report.chunksRequested}</span> range requests were served.
                  </p>
                )}
                {logs.report.truncated && !logsLossy && (
                  <p>Older blocks were not scanned - this window is the limit, not the end of the history.</p>
                )}
              </>
            )}
            {logs.status === 'running' && <p>Walking back from the head block in bounded ranges…</p>}
            {logs.status === 'failed' && (
              <p className="inline-flex items-start gap-1.5 text-rose-300">
                <WifiOff className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                <span>
                  {logs.message} No block range was read, so this is not evidence that the wallet has no jobs.
                </span>
              </p>
            )}
            <p>
              via <span className="font-mono text-slate-400">{hostOf(rpc.logs)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4">
        <p className="text-[11px] text-slate-500">
          Window {depth + 1} of 4{depth > 0 && ' - widened'}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={scanDeeper}
          disabled={!canScanDeeper || loading}
          loading={loading}
        >
          {canScanDeeper ? 'Scan further back' : 'Widest window reached'}
        </Button>
      </div>
    </GlassCard>
  );
}
