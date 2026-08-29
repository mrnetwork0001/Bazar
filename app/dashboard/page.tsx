import type { Metadata } from 'next';
import { DashboardView } from '@/components/dashboard/dashboard-view';

export const metadata: Metadata = {
  title: 'Jobs & Escrow',
  description:
    'Jobs opened by your wallet on the ERC-8183 AgenticCommerce kernel, read live from BNB Chain: budget escrowed, deliverable submitted, and the status the kernel reports.',
};

/**
 * No server fetch, deliberately.
 *
 * The only key this page has is the connected wallet address, which exists in
 * the browser and nowhere else - there is nothing to read on the server that
 * would not have to be thrown away and re-read once the wallet is known. Every
 * chain read therefore happens in `DashboardView`, through the same
 * `lib/jobs/read` functions the server would have used; the RPC endpoints are
 * all `NEXT_PUBLIC_` values, so the reader works identically in either place.
 */
export default function DashboardPage() {
  return <DashboardView />;
}
