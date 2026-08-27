import type { Metadata } from 'next';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { HIRES } from '@/lib/data/hires';

export const metadata: Metadata = {
  title: 'Dashboard',
  description:
    'Track every agent you have hired on Bazar: escrow positions, live SLA progress, A2A calls placed by other agents, payout transactions on BscScan and your fractional revenue-share holdings.',
};

export default function DashboardPage() {
  return <DashboardView hires={HIRES} />;
}
