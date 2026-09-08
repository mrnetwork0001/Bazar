'use client';

/**
 * Jobs whose client is the Altana wallet.
 *
 * A hire made through a session key is opened by the wallet, not by the
 * browser's connected account, so it never appears on /dashboard - that page
 * reads the connected address, correctly, and the two are different addresses.
 * The result was a job that existed onchain, was paid for by the reader, and
 * showed up on no page they could find.
 *
 * This reads the same kernel with the same discovery hook and renders the same
 * cards, pointed at the wallet instead. Nothing here is stored: the session
 * store's local record of hires exists so a hash can be found again, not as a
 * source of truth, and a job opened on another device belongs on this list
 * just as much.
 */

import { useMemo } from 'react';

import { JobCard } from '@/components/dashboard/job-card';
import { useJobDiscovery } from '@/components/dashboard/use-job-discovery';
import { useProviderAgents } from '@/components/dashboard/use-provider-agents';
import { Button } from '@/components/ui/button';
import { Inbox, Loader2 } from '@/components/ui/icons';
import { getDeployment, type SupportedChainId } from '@/lib/chain/addresses';
import { formatBudgetLabel } from '@/lib/jobs/read';
import type { Address } from '@/lib/types';

export interface WalletJobsProps {
  wallet: Address;
  chainId: SupportedChainId;
}

export function WalletJobs({ wallet, chainId }: WalletJobsProps) {
  const deployment = getDeployment(chainId);
  const discovery = useJobDiscovery(chainId, wallet);
  const providers = useMemo(() => discovery.jobs.map((job) => job.provider), [discovery.jobs]);
  const resolutions = useProviderAgents(chainId, providers);

  const escrowed = discovery.jobs.reduce(
    // Escrow the kernel is still holding: funded, or submitted and awaiting
    // evaluation. Anything terminal has already left.
    (sum, job) => (job.status === 'funded' || job.status === 'submitted' ? sum + job.budget : sum),
    0n,
  );

  return (
    <section aria-labelledby="wallet-jobs-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="wallet-jobs-heading" className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
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

      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
        Funded by a session key, so the kernel&rsquo;s client is this wallet rather than the account in your browser -
        which is why these do not appear on the dashboard.
        {escrowed > 0n && (
          <>
            {' '}
            <span className="text-slate-300">{formatBudgetLabel(escrowed)}</span> is escrowed
            across them right now.
          </>
        )}
      </p>

      {discovery.jobs.length > 0 ? (
        <ul className="mt-4 list-none space-y-3">
          {discovery.jobs.map((job) => (
            <JobCard
              key={job.id.toString()}
              job={job}
              chainId={chainId}
              chainTime={discovery.chainTime}
              resolution={resolutions.get(job.provider.toLowerCase())}
              explorer={deployment.explorer}
              kernel={deployment.agenticCommerce}
              // The client here is the wallet, not the browser's account, so a
              // refund has to be signed by a key the wallet holds. The button
              // on /dashboard writes from the connected account and the kernel
              // would refuse it. `claimRefund` is inside the session grant, so
              // the route exists - it is just not this button.
              canRefund={false}
            />
          ))}
        </ul>
      ) : (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] p-4">
          <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <p className="text-xs leading-relaxed text-slate-500">
            {discovery.loading
              ? 'Scanning the kernel for jobs opened by this wallet.'
              : 'No jobs opened by this wallet yet. Hiring through a session key from an agent page will list them here.'}
          </p>
        </div>
      )}
    </section>
  );
}
