'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ShieldCheck, Wallet } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BSC_CHAIN_ID, BSC_TESTNET_CHAIN_ID } from '@/lib/constants';
import { DEMO_HIRER } from '@/lib/data/hires';
import type { Hire } from '@/lib/types';
import { bscScanAddress, cn, shortAddress } from '@/lib/utils';
import { ActivityFeed } from './activity-feed';
import { DemoBanner } from './demo-banner';
import { EmptyState } from './empty-state';
import { FractionalHoldings } from './fractional-holdings';
import { HiresTable } from './hires-table';
import { StatusTabs } from './status-tabs';
import { SummaryTiles } from './summary-tiles';
import { countByTab, matchesTab, type DashboardTab } from './hire-helpers';

function chainName(chainId: number | undefined) {
  if (chainId === BSC_TESTNET_CHAIN_ID) return 'BNB Smart Chain Testnet';
  if (chainId === BSC_CHAIN_ID || chainId === undefined) return 'BNB Smart Chain';
  return `Chain ${chainId}`;
}

/** Wallet the ledger is being viewed as — the connected account, or the Bazar demo wallet. */
function WalletCard({ address, chainId, demo }: { address: string; chainId?: number; demo: boolean }) {
  return (
    <div className="glass w-full rounded-2xl p-4 sm:w-auto sm:min-w-[300px]">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <Wallet className="h-3.5 w-3.5" aria-hidden />
          Hirer wallet
        </span>
        <Badge tone={demo ? 'slate' : 'emerald'}>
          {demo ? (
            'Demo wallet'
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Connected
            </span>
          )}
        </Badge>
      </div>
      <a
        href={bscScanAddress(address, chainId ?? BSC_CHAIN_ID)}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${shortAddress(address)} on BscScan`}
        className="ring-focus mt-2 inline-flex items-center gap-1.5 rounded font-mono text-base tabular text-white transition-colors hover:text-bnb"
      >
        {shortAddress(address, 6)}
        <ArrowUpRight className="h-4 w-4 text-slate-500" aria-hidden />
      </a>
      <p className="mt-1 text-xs text-slate-500">{chainName(chainId)}</p>
    </div>
  );
}

export interface DashboardViewProps {
  hires: Hire[];
}

/**
 * Hirer dashboard shell. Renders the demo ledger until a wallet is connected,
 * then swaps the header wallet for the connected account. Everything before
 * mount matches the server markup exactly, so hydration stays clean.
 */
export function DashboardView({ hires }: DashboardViewProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const account = useAccount();
  const connected = mounted && account.status === 'connected' && Boolean(account.address);
  const address = connected && account.address ? account.address : DEMO_HIRER;

  const [tab, setTab] = useState<DashboardTab>('all');
  const counts = useMemo(() => countByTab(hires), [hires]);
  const visible = useMemo(() => hires.filter((h) => matchesTab(h, tab)), [hires, tab]);

  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-hero-glow opacity-70" aria-hidden />

      <div className="container-x pb-24 pt-10 sm:pt-14">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge tone="gold" size="md" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>
              SLA-verified escrow on BSC
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              <span className="text-gradient-white">My Hires &amp; Escrow</span>
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-400">
              Every agent you have hired — human checkout or A2A router — with its escrow position, live SLA progress and
              the BscScan transactions that moved the funds.
            </p>
          </div>

          <WalletCard address={address} chainId={connected ? account.chainId : BSC_CHAIN_ID} demo={!connected} />
        </header>

        {!connected && <DemoBanner className="mt-6" />}

        <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,330px)] lg:items-start lg:gap-6 xl:gap-8">
          {/* main column */}
          <div className="min-w-0">
            <SummaryTiles hires={hires} className="lg:grid-cols-3 xl:grid-cols-5" />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <StatusTabs value={tab} onChange={setTab} counts={counts} />
              <p className="shrink-0 text-xs text-slate-500" aria-live="polite">
                Showing <span className="tabular font-medium text-slate-300">{visible.length}</span> of{' '}
                <span className="tabular">{hires.length}</span> hires
              </p>
            </div>

            <div
              id="hires-panel"
              role="tabpanel"
              aria-labelledby={`hires-tab-${tab}`}
              className={cn('mt-4', visible.length === 0 && 'pt-2')}
            >
              {visible.length > 0 ? <HiresTable hires={visible} /> : <EmptyState tab={tab} />}
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-slate-500">
                Need another agent? Hire from the storefront, or let your own agent hire through the A2A router.
              </p>
              <div className="flex shrink-0 gap-2">
                <Button href="/marketplace" size="sm">
                  Browse marketplace
                </Button>
                <Button href="/developers" size="sm" variant="secondary">
                  A2A API
                </Button>
              </div>
            </div>
          </div>

          {/* right rail */}
          <aside className="mt-6 space-y-6 lg:mt-0" aria-label="Escrow activity and holdings">
            <ActivityFeed hires={hires} />
            <FractionalHoldings />
          </aside>
        </div>
      </div>
    </div>
  );
}
