import type { ReactNode } from 'react';
import { Bot, CircleDashed, Fingerprint, Hash, Link2, Network, Receipt, ShieldCheck, User } from '@/components/ui/icons';
import type { Address, IndexedAgent } from '@/lib/types';
import { DEPLOYMENTS, type SupportedChainId } from '@/lib/chain/addresses';
import { CopyButton } from '@/components/agents/copy-button';
import { bscScanAddress, bscScanTx, cn, formatDate, shortAddress } from '@/lib/utils';

interface RecordRowProps {
  icon: ReactNode;
  label: string;
  /** What the user sees (already shortened where appropriate). */
  display: string;
  /** Exact value placed on the clipboard; omit to hide the copy control. */
  copyValue?: string;
  href?: string;
  linkLabel?: string;
  hint?: string;
}

function RecordRow({ icon, label, display, copyValue, href, linkLabel, hint }: RecordRowProps) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-b border-white/[0.05] px-4 py-3 last:border-b-0">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
        <div className="tabular mt-0.5 break-all font-mono text-xs text-slate-200">{display}</div>
        {hint && <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1 pt-3">
        {copyValue && <CopyButton value={copyValue} label={label} />}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={linkLabel ?? `Open ${label} on BscScan`}
            title={linkLabel ?? `Open ${label} on BscScan`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors hover:border-bnb/40 hover:bg-bnb/10 hover:text-bnb ring-focus"
          >
          </a>
        )}
      </div>
    </div>
  );
}

export interface IdentityPanelProps {
  agent: IndexedAgent;
  /** Address the agent operates from, when the index publishes one. */
  agentWallet?: Address | null;
  /** Transaction that minted the identity NFT, when the index publishes one. */
  registrationTx?: string | null;
  className?: string;
}

/**
 * The raw ERC-8004 identity record, in a form a judge can verify by hand:
 * every value here can be pasted into BscScan and checked against the
 * Identity Registry the BNB Agent Studio SDK writes to.
 */
export function IdentityPanel({ agent, agentWallet, registrationTx, className }: IdentityPanelProps) {
  const deployment = DEPLOYMENTS[agent.chainId as SupportedChainId] as (typeof DEPLOYMENTS)[SupportedChainId] | undefined;
  const chainName = deployment?.name ?? `Chain ${agent.chainId}`;
  const canonical =
    !!deployment && deployment.identityRegistry.toLowerCase() === agent.registry.toLowerCase();

  const rows: RecordRowProps[] = [
    {
      icon: <Hash className="h-3.5 w-3.5" aria-hidden />,
      label: 'Agent ID',
      display: agent.agentId,
      copyValue: agent.agentId,
      hint: 'Composite index key: chain id, registry contract, token id.',
    },
    {
      icon: <Fingerprint className="h-3.5 w-3.5" aria-hidden />,
      label: 'Token ID',
      display: `#${agent.tokenId}`,
      copyValue: agent.tokenId,
      hint: 'The identity NFT minted to the owner when the agent registered.',
    },
    {
      icon: <Link2 className="h-3.5 w-3.5" aria-hidden />,
      label: 'Identity Registry',
      display: shortAddress(agent.registry, 8),
      copyValue: agent.registry,
      href: bscScanAddress(agent.registry, agent.chainId),
      linkLabel: 'View the Identity Registry contract on BscScan',
      hint: canonical
        ? 'Matches the canonical ERC-8004 registry the BNB Agent Studio SDK writes to.'
        : 'A registry deployment other than the one BNB Agent Studio writes to.',
    },
    {
      icon: <User className="h-3.5 w-3.5" aria-hidden />,
      label: 'Owner',
      display: shortAddress(agent.owner, 8),
      copyValue: agent.owner,
      href: bscScanAddress(agent.owner, agent.chainId),
      linkLabel: 'View the owner address on BscScan',
      hint: agent.ownerLabel ? `Resolves to ${agent.ownerLabel}.` : 'No ENS or certified name on this address.',
    },
  ];

  if (agentWallet && agentWallet.toLowerCase() !== agent.owner.toLowerCase()) {
    rows.push({
      icon: <Bot className="h-3.5 w-3.5" aria-hidden />,
      label: 'Agent wallet',
      display: shortAddress(agentWallet, 8),
      copyValue: agentWallet,
      href: bscScanAddress(agentWallet, agent.chainId),
      linkLabel: 'View the agent wallet on BscScan',
      hint: 'The address the agent transacts from, separate from the owner that holds the identity.',
    });
  }

  if (registrationTx) {
    rows.push({
      icon: <Receipt className="h-3.5 w-3.5" aria-hidden />,
      label: 'Registration tx',
      display: shortAddress(registrationTx, 8),
      copyValue: registrationTx,
      href: bscScanTx(registrationTx, agent.chainId),
      linkLabel: 'View the registration transaction on BscScan',
      hint: 'The transaction that minted this identity into the registry.',
    });
  }

  rows.push({
    icon: <Network className="h-3.5 w-3.5" aria-hidden />,
    label: 'Network',
    display: `${chainName} · ${agent.chainId}`,
    hint: `Registered ${formatDate(agent.registeredAt)} · record last updated ${formatDate(agent.updatedAt)}.`,
  });

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl', className)}>
      <div className="grid grid-cols-1 md:grid-cols-2">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              'min-w-0',
              // The last row spans the full width so the grid never leaves a gap.
              i === rows.length - 1 && rows.length % 2 === 1 && 'md:col-span-2',
              i % 2 === 1 && 'md:border-l md:border-white/[0.05]',
            )}
          >
            <RecordRow {...row} />
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2.5 border-t border-white/[0.06] bg-white/[0.015] px-4 py-3">
        {agent.verified ? (
          <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        ) : (
          <CircleDashed className="mt-px h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        )}
        <p className="text-[11px] leading-relaxed text-slate-500">
          {agent.verified ? (
            <>
              <span className="font-medium text-emerald-300">Marked verified</span> in the Identity Registry index.
              Bazar still ranks on reputation rather than on this flag.
            </>
          ) : (
            <>
              <span className="font-medium text-slate-300">No verification flag set.</span> Nothing on BNB Smart Chain
              currently sets this field, so Bazar does not use it as a trust signal and does not offer it as a filter.
              Rank and reputation below are the real signals.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
