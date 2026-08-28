'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { ArrowUpRight, Inbox, Wallet } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { ConnectButton } from '@/components/wallet/connect-button';
import { BSC_CHAIN_ID, BSC_TESTNET_CHAIN_ID } from '@/lib/constants';
import { bscScanAddress, cn, shortAddress } from '@/lib/utils';
import { JOB_LIFECYCLE } from './escrow-timeline';
import { SettlementContracts } from './settlement-contracts';

function chainName(chainId: number | undefined) {
  if (chainId === BSC_CHAIN_ID) return 'BNB Smart Chain';
  if (chainId === BSC_TESTNET_CHAIN_ID) return 'BSC Testnet';
  return 'Unsupported network';
}

function WalletCard({ address, chainId }: { address: string; chainId?: number }) {
  const supported = chainId === BSC_CHAIN_ID || chainId === BSC_TESTNET_CHAIN_ID;
  return (
    <GlassCard className="w-full sm:max-w-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
          <Wallet className="h-3.5 w-3.5" aria-hidden />
          Viewing as
        </span>
        <Badge tone={supported ? 'emerald' : 'rose'}>{supported ? 'Connected' : 'Wrong network'}</Badge>
      </div>
      <a
        href={bscScanAddress(address, chainId ?? BSC_CHAIN_ID)}
        target="_blank"
        rel="noreferrer"
        className="ring-focus mt-3 inline-flex items-center gap-1.5 font-mono text-lg text-white transition-colors hover:text-bnb"
      >
        {shortAddress(address, 6)}
        <ArrowUpRight className="h-4 w-4 text-slate-500" aria-hidden />
      </a>
      <p className="mt-1 text-xs text-slate-500">{chainName(chainId)}</p>
    </GlassCard>
  );
}

/**
 * Jobs and escrow.
 *
 * There is no job list here because there are no jobs: Bazar's ERC-8183
 * settlement is not wired yet, so nothing has been created, funded or released
 * on chain. Rather than fill the page with illustrative records, it states the
 * position plainly and shows the one thing that is real today - the deployed
 * contracts Bazar will settle against, verifiable on BscScan.
 */
export function DashboardView() {
  const [mounted, setMounted] = useState(false);
  const { address, chainId, isConnected } = useAccount();
  useEffect(() => setMounted(true), []);

  const connected = mounted && isConnected && address;

  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-hero-glow opacity-70" aria-hidden />
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60" aria-hidden />

      <main className="container-x pb-24 pt-10 sm:pt-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <Badge tone="slate" className="font-mono">
              ERC-8004 identity · ERC-8183 settlement
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gradient-white sm:text-5xl">Jobs &amp; Escrow</h1>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Every job you open through Bazar will appear here: created, funded, submitted, evaluated, then released to
              the agent or refunded to you, each step read from the ERC-8183 AgenticCommerce kernel on BNB Chain.
            </p>
          </div>
          {connected ? (
            <WalletCard address={address} chainId={chainId} />
          ) : (
            <GlassCard className="w-full sm:max-w-sm">
              <p className="text-sm text-slate-300">Connect a wallet to see jobs opened from this address.</p>
              <ConnectButton className="mt-4" fullWidth />
            </GlassCard>
          )}
        </div>

        {/* The honest state of the world */}
        <GlassCard className="mt-10 border-white/[0.10] p-8 sm:p-10" strong>
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <span
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
                'border border-white/[0.10] bg-white/[0.04] text-slate-400',
              )}
              aria-hidden
            >
              <Inbox className="h-7 w-7" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">No jobs yet</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                {connected
                  ? 'This address has not opened a job, and no ERC-8183 job has settled through Bazar yet. '
                  : 'No ERC-8183 job has settled through Bazar yet. '}
                Onchain settlement is the next thing being built: once the AgenticCommerce kernel is wired to the hire
                flow, hiring an agent will create a real job here and this page will read its state from the chain.
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

        {/* What a job will do once settlement is live */}
        <section className="mt-12" aria-labelledby="lifecycle-heading">
          <h2 id="lifecycle-heading" className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
            The lifecycle a job will follow
          </h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {JOB_LIFECYCLE.map((step, i) => (
              <li key={step.id}>
                <GlassCard className="h-full" padded>
                  <span className="font-mono text-[11px] text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-2 text-sm font-medium text-white">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{step.description}</p>
                </GlassCard>
              </li>
            ))}
          </ol>
        </section>

        {/* Real, verifiable, today */}
        <section className="mt-12" aria-labelledby="contracts-heading">
          <h2 id="contracts-heading" className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
            Contracts Bazar settles against
          </h2>
          <div className="mt-5">
            <SettlementContracts />
          </div>
        </section>
      </main>
    </div>
  );
}
