'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Inbox, Loader2, ShieldOff, WifiOff } from '@/components/ui/icons';
import { ConnectButton } from '@/components/wallet/connect-button';
import { BSC_MAINNET, BSC_TESTNET, getDeployment, type SupportedChainId } from '@/lib/chain/addresses';
import { JOB_LIFECYCLE_NODES } from '@/lib/jobs/lifecycle';
import { PAYMENT_TOKEN_SYMBOL } from '@/lib/jobs/read';
import type { Address } from '@/lib/types';

import { JobCard } from './job-card';
import { JobLookup } from './job-lookup';
import { JobSummary } from './job-summary';
import { ScanReport } from './scan-report';
import { SettlementContracts } from './settlement-contracts';
import { useJobDiscovery } from './use-job-discovery';
import { useProviderAgents } from './use-provider-agents';
import { WalletPanel } from './wallet-panel';

/**
 * Jobs and escrow, read live from the ERC-8183 AgenticCommerce kernel.
 *
 * This page used to be a static empty state, correctly, because nothing had
 * ever settled through Bazar. It now reads the chain - but the empty state it
 * replaced has NOT been thrown away, because a wallet with no jobs is still the
 * common case and is still the right thing to render. What changed is that the
 * emptiness is now a measured result rather than an assumption, and the page
 * separates the three things that can produce an empty list:
 *
 *   - the chain was read and this wallet has no jobs in the window;
 *   - the chain was read incompletely, so the list may have holes;
 *   - the chain could not be read at all, which is not evidence of anything.
 *
 * Nothing on this page is invented. Every job id, budget, status, expiry,
 * deliverable and address is a field of a `getJob` tuple. Budgets are in the
 * kernel's settlement token (`U`, 18 decimals) and never in BNB.
 */

function supportedChain(chainId: number | undefined): SupportedChainId | null {
  if (chainId === BSC_MAINNET) return BSC_MAINNET;
  if (chainId === BSC_TESTNET) return BSC_TESTNET;
  return null;
}

function PageHeader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-2xl">
        <Badge tone="slate" className="font-mono">
          ERC-8004 identity · ERC-8183 settlement
        </Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gradient-white sm:text-5xl">Jobs &amp; Escrow</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Every job opened from your wallet on the AgenticCommerce kernel, read live: budget escrowed in{' '}
          <span className="font-mono text-slate-300">{PAYMENT_TOKEN_SYMBOL}</span>, the deliverable if one was
          submitted, and the status the kernel itself reports.
        </p>
      </div>
      {children}
    </div>
  );
}

/** The five nodes a job walks through, shown before a wallet is connected. */
function LifecycleExplainer() {
  return (
    <section className="mt-12" aria-labelledby="lifecycle-heading">
      <h2 id="lifecycle-heading" className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
        The lifecycle a job follows
      </h2>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {JOB_LIFECYCLE_NODES.map((node, i) => (
          <li key={node.id}>
            <GlassCard className="h-full">
              <span className="font-mono text-[11px] text-slate-500">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-2 text-sm font-medium text-white">{node.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{node.description}</p>
            </GlassCard>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-hero-glow opacity-70" aria-hidden />
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60" aria-hidden />
      <main className="container-x pb-24 pt-10 sm:pt-14">{children}</main>
    </div>
  );
}

export function DashboardView() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, chainId: walletChainId, isConnected } = useAccount();
  const connected = mounted && isConnected && !!address;
  const chainId = connected ? supportedChain(walletChainId) : null;

  const discovery = useJobDiscovery(chainId, connected ? (address as Address) : undefined);
  const providers = useMemo(() => discovery.jobs.map((job) => job.provider), [discovery.jobs]);
  const resolutions = useProviderAgents(chainId, providers);

  /* ---------------- not connected ---------------- */

  if (!connected || !address) {
    return (
      <Shell>
        <PageHeader>
          <GlassCard className="w-full lg:max-w-sm">
            <p className="text-sm text-slate-300">
              Connect a wallet to read the jobs it has opened on the kernel. Bazar reads only; it never asks for a key
              and never custodies funds.
            </p>
            <ConnectButton className="mt-4" fullWidth />
          </GlassCard>
        </PageHeader>

        <GlassCard className="mt-10 border-white/[0.10] p-8 sm:p-10" strong>
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/[0.10] bg-white/[0.04] text-slate-400"
              aria-hidden
            >
              <Inbox className="h-7 w-7" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">Nothing to read yet</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                This page reads jobs by wallet address, so there is nothing to show until one is connected. It will not
                show sample jobs in the meantime.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button href="/marketplace" variant="primary" size="md">
                  Browse agents
                </Button>
                <Button href="/developers#escrow" variant="secondary" size="md">
                  How settlement works
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>

        <LifecycleExplainer />

        <section className="mt-12" aria-labelledby="contracts-heading">
          <h2 id="contracts-heading" className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
            Contracts Bazar settles against
          </h2>
          <div className="mt-5">
            <SettlementContracts />
          </div>
        </section>
      </Shell>
    );
  }

  /* ---------------- connected, wrong network ---------------- */

  if (!chainId) {
    return (
      <Shell>
        <PageHeader>
          <WalletPanel address={address as Address} walletChainId={walletChainId} chainId={null} position={null} />
        </PageHeader>

        <GlassCard className="mt-10 border-rose-400/20 p-8" strong>
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-400/10 text-rose-300"
              aria-hidden
            >
              <ShieldOff className="h-7 w-7" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">This wallet is on a network Bazar does not read</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                The AgenticCommerce kernel Bazar settles against is deployed on BNB Smart Chain (56) and BSC Testnet
                (97). No job list is shown for chain {walletChainId ?? 'unknown'}, because Bazar has not read one.
              </p>
            </div>
          </div>
        </GlassCard>

        <LifecycleExplainer />
      </Shell>
    );
  }

  /* ---------------- connected, supported network ---------------- */

  const deployment = getDeployment(chainId);
  const bothFailed = discovery.sweep.status === 'failed' && discovery.logs.status === 'failed';
  const anyFailed = discovery.sweep.status === 'failed' || discovery.logs.status === 'failed';
  const lossy = discovery.logs.status === 'ok' && discovery.logs.report.chunksFailed > 0;
  const incomplete = anyFailed || lossy;
  const settled = discovery.sweep.status !== 'running' && discovery.logs.status !== 'running';

  return (
    <Shell>
      <PageHeader>
        <WalletPanel
          address={address as Address}
          walletChainId={walletChainId}
          chainId={chainId}
          position={discovery.position}
        />
      </PageHeader>

      {discovery.kernel?.paused && (
        <GlassCard className="mt-6 border-amber-400/25 bg-amber-400/[0.06]">
          <p className="text-sm text-amber-200">
            The AgenticCommerce kernel on chain {chainId} is currently paused. Existing jobs still read normally; new
            ones cannot be created or funded until it is unpaused.
          </p>
        </GlassCard>
      )}

      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start lg:gap-6 xl:gap-8">
        <div className="min-w-0">
          <JobSummary jobs={discovery.jobs} kernel={discovery.kernel} />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
              Jobs opened by this wallet
            </h2>
            <div className="flex items-center gap-3">
              {discovery.loading && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Reading the kernel…
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={discovery.refresh} disabled={discovery.loading}>
                Refresh
              </Button>
            </div>
          </div>

          {discovery.jobs.length > 0 ? (
            <>
              <ul className="mt-4 space-y-3 list-none">
                {discovery.jobs.map((job) => (
                  <JobCard
                    key={job.id.toString()}
                    job={job}
                    chainTime={discovery.chainTime}
                    resolution={resolutions.get(job.provider.toLowerCase())}
                    explorer={deployment.explorer}
                    kernel={deployment.agenticCommerce}
                  />
                ))}
              </ul>
              {incomplete && settled && (
                <p className="mt-3 text-xs leading-relaxed text-amber-300/90">
                  This list is not necessarily complete - part of the scan did not come back. See what was scanned.
                </p>
              )}
            </>
          ) : (
            <EmptyJobs
              loading={discovery.loading}
              bothFailed={bothFailed}
              incomplete={incomplete}
              canScanDeeper={discovery.canScanDeeper}
              onScanDeeper={discovery.scanDeeper}
            />
          )}
        </div>

        <div className="mt-6 space-y-6 lg:mt-0">
          <ScanReport
            chainId={chainId}
            sweep={discovery.sweep}
            logs={discovery.logs}
            depth={discovery.depth}
            canScanDeeper={discovery.canScanDeeper}
            scanDeeper={discovery.scanDeeper}
            loading={discovery.loading}
          />
          <JobLookup
            chainId={chainId}
            chainTime={discovery.chainTime}
            explorer={deployment.explorer}
            kernel={deployment.agenticCommerce}
            wallet={address as Address}
          />
          <SettlementContracts chainId={chainId} />
        </div>
      </div>
    </Shell>
  );
}

/**
 * The three empty results, kept apart on purpose.
 *
 * "We read the chain and you have no jobs" and "we could not read the chain"
 * look identical if you only count rows, and conflating them is how a UI ends
 * up telling someone their job vanished.
 */
function EmptyJobs({
  loading,
  bothFailed,
  incomplete,
  canScanDeeper,
  onScanDeeper,
}: {
  loading: boolean;
  bothFailed: boolean;
  incomplete: boolean;
  canScanDeeper: boolean;
  onScanDeeper: () => void;
}) {
  if (loading) {
    return (
      <GlassCard className="mt-4 p-8" strong>
        <p className="inline-flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Reading job ids and JobCreated logs from the kernel…
        </p>
      </GlassCard>
    );
  }

  if (bothFailed) {
    return (
      <GlassCard className="mt-4 border-rose-400/20 p-8" strong>
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-400/10 text-rose-300"
            aria-hidden
          >
            <WifiOff className="h-7 w-7" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-white">The kernel could not be read</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Both ways of finding this wallet&rsquo;s jobs failed, so this page is showing nothing rather than
              guessing. This is not a statement that the wallet has no jobs - Bazar simply did not get an answer. The
              panel beside this one names the endpoints and what each one returned.
            </p>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="mt-4 p-8" strong>
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/[0.10] bg-white/[0.04] text-slate-400"
          aria-hidden
        >
          <Inbox className="h-7 w-7" />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-white">No jobs for this wallet</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            {incomplete
              ? 'Nothing was found in the part of the chain Bazar managed to read. Part of the scan did not come back, so this is not proof the wallet has none - widen the window, or read a known job id directly.'
              : 'The kernel was read and this address is not the client on any job in the scanned window.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button href="/marketplace" variant="primary" size="md">
              Browse agents
            </Button>
            {canScanDeeper && (
              <Button variant="secondary" size="md" onClick={onScanDeeper}>
                Scan further back
              </Button>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
