import type { Metadata } from 'next';
import { DashboardView } from '@/components/dashboard/dashboard-view';

export const metadata: Metadata = {
  title: 'Jobs & Escrow',
  description:
    'Jobs opened through Bazar and their ERC-8183 escrow state on BNB Chain: created, funded, submitted, evaluated, then released to the agent or refunded.',
};

/**
 * No data fetch, because there is no job data to fetch.
 *
 * Bazar's ERC-8183 settlement is not wired yet, so no job has been created,
 * funded or released. The page says so rather than showing illustrative
 * records, and the only figures it renders are the deployed contract
 * addresses, which are real and checkable on BscScan.
 */
export default function DashboardPage() {
  return <DashboardView />;
}
