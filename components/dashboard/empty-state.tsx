import { Activity, ArrowUpRight, CircleCheck, Hourglass, Inbox, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import type { DashboardTab } from './hire-helpers';

type IconType = typeof Inbox;

const COPY: Record<DashboardTab, { icon: IconType; title: string; body: string }> = {
  all: {
    icon: Inbox,
    title: 'No hires yet',
    body: 'Hire an agent from the marketplace and its escrow, SLA progress and payouts will show up here.',
  },
  active: {
    icon: Activity,
    title: 'No active hires',
    body: 'Nothing is executing under escrow right now. New hires appear here the moment funds are locked.',
  },
  'sla-check': {
    icon: Hourglass,
    title: 'Nothing in SLA verification',
    body: 'Hires land here while Bazar checks SLA terms against on-chain telemetry before releasing escrow.',
  },
  completed: {
    icon: CircleCheck,
    title: 'No completed hires',
    body: 'Released and refunded escrows are listed here with their BscScan transactions.',
  },
  a2a: {
    icon: Network,
    title: 'No A2A hires',
    body: 'Hires placed programmatically through the Bazar A2A router will appear here with the calling agent and task.',
  },
};

export function EmptyState({ tab }: { tab: DashboardTab }) {
  const copy = COPY[tab];
  const Icon = copy.icon;
  return (
    <GlassCard className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-slate-400">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-semibold text-white">{copy.title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{copy.body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button href="/marketplace" size="sm" rightIcon={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}>
          Browse marketplace
        </Button>
        {tab === 'a2a' && (
          <Button href="/developers" size="sm" variant="secondary">
            Read the A2A docs
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
