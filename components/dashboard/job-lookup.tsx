'use client';

import { useCallback, useMemo, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Search } from '@/components/ui/icons';
import type { SupportedChainId } from '@/lib/chain/addresses';
import { readJobResult, type OnchainJob } from '@/lib/jobs/read';
import type { Address } from '@/lib/types';
import { shortAddress } from '@/lib/utils';

import { JobCard } from './job-card';
import { useProviderAgents } from './use-provider-agents';

/**
 * Read one job by id.
 *
 * This is here because the log scan is unreliable by measurement, not by
 * accident: on mainnet the public log host refused most range requests. When a
 * job is missing from the list, the honest recovery is not to guess - it is to
 * let the reader name the id and read it straight off the kernel with
 * `getJob`, which goes through the call RPC and works.
 *
 * `readJobResult` is used rather than `readJob` because the difference between
 * "the kernel has never issued that id" and "the RPC could not be reached" is
 * exactly what a reader needs here, and `readJob` collapses both to null.
 */

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; job: OnchainJob }
  | { status: 'empty'; message: string }
  | { status: 'error'; message: string };

export interface JobLookupProps {
  chainId: SupportedChainId;
  chainTime: number | null;
  explorer: string;
  kernel: Address;
  /** The connected wallet, so a job belonging to someone else can be labelled. */
  wallet: Address;
}

export function JobLookup({ chainId, chainTime, explorer, kernel, wallet }: JobLookupProps) {
  const [value, setValue] = useState('');
  const [state, setState] = useState<LookupState>({ status: 'idle' });

  const providers = useMemo<Address[]>(
    () => (state.status === 'found' ? [state.job.provider] : []),
    [state],
  );
  const resolutions = useProviderAgents(chainId, providers);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = value.trim().replace(/^#/, '');
      if (!/^\d+$/.test(trimmed) || trimmed === '0') {
        setState({ status: 'empty', message: 'Job ids are whole numbers starting at 1.' });
        return;
      }
      setState({ status: 'loading' });
      const result = await readJobResult(chainId, BigInt(trimmed));
      if (result.ok) {
        setState({ status: 'found', job: result.job });
      } else if (result.failure === 'not-found') {
        setState({ status: 'empty', message: result.message });
      } else {
        setState({ status: 'error', message: result.message });
      }
    },
    [chainId, value],
  );

  const foreign =
    state.status === 'found' && state.job.client.toLowerCase() !== wallet.toLowerCase() ? state.job.client : null;

  return (
    <GlassCard as="section" aria-labelledby="lookup-heading" padded={false} className="overflow-hidden">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <h2 id="lookup-heading" className="text-sm font-semibold text-white">
          Read any job by id
        </h2>
        <p className="mt-0.5 text-xs leading-snug text-slate-500">
          Calls <span className="font-mono">getJob(jobId)</span> on the kernel directly. This path does not depend on
          log scanning, so it works even when the RPC refuses ranges.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2 px-5 py-4">
        <label htmlFor="job-id" className="sr-only">
          Job id
        </label>
        <input
          id="job-id"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 56664"
          className="ring-focus h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 font-mono text-sm tabular text-white placeholder:text-slate-600"
        />
        <Button type="submit" variant="secondary" size="md" leftIcon={<Search className="h-4 w-4" aria-hidden />} loading={state.status === 'loading'}>
          Read
        </Button>
      </form>

      {state.status === 'empty' && (
        <p className="px-5 pb-5 text-xs text-slate-400">{state.message}</p>
      )}
      {state.status === 'error' && (
        <p className="px-5 pb-5 text-xs text-rose-300">
          {state.message} Nothing was read, so this says nothing about whether that job exists.
        </p>
      )}
      {state.status === 'found' && (
        <div className="px-5 pb-5">
          {foreign && (
            <p className="mb-3 text-xs text-slate-400">
              This job&rsquo;s client is{' '}
              <span className="font-mono text-slate-300">{shortAddress(foreign, 6)}</span>, not the connected wallet.
            </p>
          )}
          <ul className="list-none">
            <JobCard
              job={state.job}
              chainTime={chainTime}
              resolution={resolutions.get(state.job.provider.toLowerCase())}
              explorer={explorer}
              kernel={kernel}
            />
          </ul>
        </div>
      )}
    </GlassCard>
  );
}
