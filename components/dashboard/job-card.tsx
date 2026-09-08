'use client';

import { useId, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import {
  BadgeCheck,
  Bot,
  ChevronDown,
  ExternalLink,
  FileSignature,
  Hourglass,
  Layers,
  TriangleAlert,
} from '@/components/ui/icons';
import { canClaimRefund, isExpiredAt } from '@/lib/chain/job-status';
import { isSettled, JOB_STATUS_META } from '@/lib/jobs/lifecycle';
import { formatBudgetLabel, type OnchainJob } from '@/lib/jobs/read';
import type { Address } from '@/lib/types';
import type { SupportedChainId } from '@/lib/chain/addresses';
import { ClaimRefundButton } from '@/components/dashboard/claim-refund-button';
import { cn, shortAddress } from '@/lib/utils';

import { formatDelta, formatUtcDateTime } from './format';
import { JobLifecycle, LifecycleRail } from './escrow-timeline';
import { ZERO_ADDRESS, type ProviderResolution } from './use-provider-agents';

/**
 * One real job, exactly as `getJob(jobId)` returned it.
 *
 * Every value on this card is a field of that tuple or a direct consequence of
 * one. Nothing is estimated, and the two places where the chain is silent are
 * said out loud rather than filled in:
 *
 *   - `submittedAt == 0` means no deliverable was ever submitted. The card says
 *     so instead of showing an empty "deliverable" row that reads like a
 *     rendering failure, and the lifecycle rail leaves that node unlit.
 *   - a `provider` address that no indexed ERC-8004 agent owns is rendered as
 *     the address it is. The job is still real; Bazar just cannot name who is
 *     behind it, and inventing a name would be a lie about the counterparty.
 */

export interface JobCardProps {
  job: OnchainJob;
  /** Chain the job lives on, for the refund write. */
  chainId: SupportedChainId;
  /** Re-read this wallet's jobs once a refund confirms. */
  onRefunded?: () => void;
  /**
   * Offer the refund control. False where the card may be showing a job the
   * connected wallet does not own - the kernel would refuse that caller
   * anyway, and a button whose only outcome is a revert is worse than no
   * button.
   */
  canRefund?: boolean;
  /** Head-block timestamp in seconds, or null when the chain time is unknown. */
  chainTime: number | null;
  resolution: ProviderResolution | undefined;
  explorer: string;
  /** AgenticCommerce kernel address, for the "read this job onchain" link. */
  kernel: Address;
}

function ProviderLine({
  provider,
  resolution,
  explorer,
}: {
  provider: Address;
  resolution: ProviderResolution | undefined;
  explorer: string;
}) {
  const addressLink = (
    <a
      href={`${explorer}/address/${provider}`}
      target="_blank"
      rel="noreferrer"
      className="ring-focus font-mono text-xs text-slate-300 underline decoration-white/20 underline-offset-2 transition-colors hover:text-bnb"
    >
      {shortAddress(provider, 6)}
    </a>
  );

  if (provider.toLowerCase() === ZERO_ADDRESS) {
    return (
      <p className="text-xs text-slate-400">
        <span className="text-slate-500">Provider</span> not set yet - the kernel accepts a zero-address provider at
        creation and takes one later through <span className="font-mono text-slate-300">setProvider</span>.
      </p>
    );
  }

  switch (resolution?.status) {
    case 'resolved':
      return (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <Bot className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
          <a
            href={`/agents/${resolution.agent.slug}`}
            className="ring-focus font-medium text-white transition-colors hover:text-bnb"
          >
            {resolution.agent.name}
          </a>
          {resolution.agent.verified && (
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-300" aria-label="Verified in the Identity Registry" />
          )}
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">token #{resolution.agent.tokenId}</span>
          <span className="text-slate-600">·</span>
          {addressLink}
        </p>
      );
    case 'ambiguous':
      return (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <Bot className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
          {addressLink}
          <span className="text-slate-500">
            owns {resolution.count} indexed agents, so the job does not identify which one.
          </span>
        </p>
      );
    case 'unregistered':
      return (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <Bot className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
          {addressLink}
          <span className="text-slate-500">- no ERC-8004 agent indexed against this address.</span>
        </p>
      );
    case 'unavailable':
      return (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <Bot className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
          {addressLink}
          <span className="text-slate-500">- the agent index did not answer, so the provider is unnamed here.</span>
        </p>
      );
    case 'resolving':
    default:
      return (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <Bot className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
          {addressLink}
        </p>
      );
  }
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 break-all text-xs text-slate-300">{children}</dd>
    </div>
  );
}

export function JobCard({
  job,
  chainId,
  chainTime,
  resolution,
  explorer,
  kernel,
  onRefunded,
  canRefund = true,
}: JobCardProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const meta = JOB_STATUS_META[job.status];
  const expired = chainTime !== null && isExpiredAt(job.expiredAt, chainTime);
  const refundable = chainTime !== null && canClaimRefund(job.status, job.expiredAt, chainTime);
  const expiryDelta = formatDelta(job.expiredAt, chainTime);
  const submitted = job.submittedAt > 0;

  // A settled job's expiry is history, not a warning. Calling it "Expired"
  // beside a COMPLETED badge reads as a contradictory status rather than as the
  // timestamp it is, so terminal jobs get the neutral label.
  const terminal = isSettled(job.status);
  const expiryLabel = terminal ? 'Expiry' : expired ? 'Expiry passed' : 'Expires';

  return (
    <GlassCard as="li" padded={false} className="overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`${explorer}/address/${kernel}#readProxyContract`}
                target="_blank"
                rel="noreferrer"
                title={`Job #${job.id} - read it with getJob(${job.id}) on the AgenticCommerce kernel on BscScan`}
                className="ring-focus inline-flex items-center gap-1 font-mono text-sm font-medium tabular text-white transition-colors hover:text-bnb"
              >
                Job #{job.id.toString()}
                <ExternalLink className="h-3 w-3 text-slate-500" aria-hidden />
              </a>
              <Badge tone={meta.tone} title={meta.description}>
                {meta.label}
                {job.status === 'unknown' ? ` (uint8 ${job.statusRaw})` : ''}
              </Badge>
              {refundable && (
                <Badge tone="violet" title="Escrow is still held and the expiry has elapsed, so claimRefund would be accepted.">
                  Refund claimable
                </Badge>
              )}
            </div>
            <div className="mt-2">
              <ProviderLine provider={job.provider} resolution={resolution} explorer={explorer} />
            </div>
          </div>

          <div className="text-right">
            <p className="font-mono text-base tabular text-white">{formatBudgetLabel(job.budget)}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {job.budget === 0n ? 'No budget set' : 'Budget, settlement token'}
            </p>
          </div>
        </div>

        <p className={cn('mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300', !open && 'line-clamp-3')}>
          {job.description.trim().length > 0 ? job.description : 'No description was written into this job.'}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <LifecycleRail status={job.status} submittedAt={job.submittedAt} />

          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Hourglass className="h-3.5 w-3.5 text-slate-500" aria-hidden />
            {job.expiredAt === 0 ? (
              <span className="text-slate-500">No expiry set</span>
            ) : (
              <>
                <span className={cn(expired && !terminal && 'text-violet-300')}>{expiryLabel}</span>
                <span className="tabular">{expiryDelta ?? formatUtcDateTime(job.expiredAt)}</span>
              </>
            )}
          </span>

          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <FileSignature className="h-3.5 w-3.5 text-slate-500" aria-hidden />
            {submitted ? (
              <>
                Submitted <span className="tabular">{formatDelta(job.submittedAt, chainTime) ?? formatUtcDateTime(job.submittedAt)}</span>
              </>
            ) : (
              <span className="text-slate-500">No deliverable submitted</span>
            )}
          </span>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className="ring-focus ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            {open ? 'Hide detail' : 'Show detail'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
        </div>
      </div>

      {open && (
        <div id={panelId} className="border-t border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
          <JobLifecycle status={job.status} submittedAt={job.submittedAt} />

          {refundable && (
            <p className="mt-5 flex items-start gap-2 rounded-xl border border-violet-400/25 bg-violet-400/[0.07] p-3 text-xs leading-relaxed text-violet-200">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                The expiry has passed with the budget still escrowed. The kernel still reports{' '}
                <span className="font-mono">{meta.label.toUpperCase()}</span> - it only moves to EXPIRED when the client
                calls <span className="font-mono">claimRefund({job.id.toString()})</span>.
                {canRefund && (
                  <ClaimRefundButton jobId={job.id} chainId={chainId} onRefunded={onRefunded} />
                )}
              </span>
            </p>
          )}

          <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="Client">
              <a
                href={`${explorer}/address/${job.client}`}
                target="_blank"
                rel="noreferrer"
                className="ring-focus font-mono transition-colors hover:text-bnb"
              >
                {shortAddress(job.client, 6)}
              </a>
            </DetailRow>
            <DetailRow label="Provider">
              <a
                href={`${explorer}/address/${job.provider}`}
                target="_blank"
                rel="noreferrer"
                className="ring-focus font-mono transition-colors hover:text-bnb"
              >
                {shortAddress(job.provider, 6)}
              </a>
            </DetailRow>
            <DetailRow label="Evaluator">
              <a
                href={`${explorer}/address/${job.evaluator}`}
                target="_blank"
                rel="noreferrer"
                className="ring-focus font-mono transition-colors hover:text-bnb"
              >
                {shortAddress(job.evaluator, 6)}
              </a>
            </DetailRow>
            <DetailRow label="Hook">
              <a
                href={`${explorer}/address/${job.hook}`}
                target="_blank"
                rel="noreferrer"
                className="ring-focus font-mono transition-colors hover:text-bnb"
              >
                {shortAddress(job.hook, 6)}
              </a>
            </DetailRow>
            <DetailRow label="Expiry">
              {job.expiredAt === 0 ? 'Not set' : formatUtcDateTime(job.expiredAt)}
            </DetailRow>
            <DetailRow label="Status (uint8)">
              <span className="font-mono tabular">{job.statusRaw}</span>{' '}
              <span className="text-slate-500">- {meta.label}</span>
            </DetailRow>
            <DetailRow label="Submitted at">
              {submitted ? (
                formatUtcDateTime(job.submittedAt)
              ) : (
                <span className="text-slate-500">0 - nothing was ever submitted</span>
              )}
            </DetailRow>
            <div className="min-w-0 sm:col-span-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Deliverable</dt>
              <dd className="mt-1 break-all font-mono text-[11px] text-slate-300">
                {submitted ? (
                  job.deliverable
                ) : (
                  <span className="text-slate-500">
                    0x00… - the kernel holds no deliverable hash for this job
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
            <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Read live from <span className="font-mono">getJob({job.id.toString()})</span> on the AgenticCommerce
              kernel at <span className="font-mono">{shortAddress(kernel, 6)}</span>, chain {job.chainId}.
            </span>
          </p>
        </div>
      )}
    </GlassCard>
  );
}
