'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Network, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_TONE } from '@/components/marketplace/marketplace-config';
import { HIRE_STATUS_META } from '@/lib/data/hires';
import type { Hire } from '@/lib/types';
import { clamp, cn, formatRelative, formatToken, periodLabel } from '@/lib/utils';
import { HireDetails } from './hire-details';
import { STATUS_ACCENT, callerLabel, hasEnded, type ResolvedHire } from './hire-helpers';

/* -------------------------------- columns -------------------------------- */

export interface HireColumn {
  id: string;
  label: string;
  /** Applied to both the <th> and its matching <td> so they can never drift apart. */
  className?: string;
  /** Header text is visually hidden (icon-only action column). */
  srOnly?: boolean;
}

/**
 * Column model for the md+ table. Lives here so `<thead>` in `hires-table` and
 * the cells below always share one source of truth for visibility + alignment.
 * Plan and Source drop out below xl, where the dashboard's right rail narrows
 * the main column — both are still shown in the expanded panel and mobile card.
 */
export const HIRE_COLUMNS: readonly HireColumn[] = [
  { id: 'agent', label: 'Agent' },
  { id: 'plan', label: 'Plan', className: 'hidden xl:table-cell' },
  { id: 'amount', label: 'Amount', className: 'text-right' },
  { id: 'status', label: 'Status' },
  { id: 'sla', label: 'SLA progress', className: 'w-[136px]' },
  { id: 'source', label: 'Source', className: 'hidden xl:table-cell' },
  { id: 'dates', label: 'Created / Expires' },
  { id: 'actions', label: 'Details', className: 'w-12 text-right', srOnly: true },
];

const COL = Object.fromEntries(HIRE_COLUMNS.map((c) => [c.id, c.className])) as Record<string, string | undefined>;

/* --------------------------------- cells --------------------------------- */

function AgentCell({ resolved }: { resolved: ResolvedHire }) {
  const { hire, agent, category } = resolved;
  const initials = agent?.avatar.initials ?? hire.agentId.slice(0, 2).toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className={cn(
          'flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-br text-[11px] font-semibold text-white ring-1 ring-inset ring-white/20',
          agent?.avatar.gradient ?? 'from-slate-600 to-slate-800',
        )}
      >
        {initials}
      </span>
      <div className="min-w-0">
        {agent ? (
          <Link
            href={`/agents/${agent.id}`}
            className="ring-focus block truncate rounded text-sm font-medium text-white transition-colors hover:text-bnb"
          >
            {agent.name}
          </Link>
        ) : (
          <span className="block truncate font-mono text-sm text-slate-300">{hire.agentId}</span>
        )}
        {category && (
          <span className="mt-1 flex">
            <Badge tone={CATEGORY_TONE[category.accent]}>{category.shortName}</Badge>
          </span>
        )}
      </div>
    </div>
  );
}

function PlanCell({ resolved }: { resolved: ResolvedHire }) {
  const { hire, tier } = resolved;
  if (!tier) return <span className="font-mono text-xs text-slate-400">{hire.tierId}</span>;
  return (
    <div className="min-w-0">
      <p className="truncate text-sm text-slate-200">{tier.name}</p>
      <p className="truncate font-mono text-[11px] tabular text-slate-500">
        {formatToken(tier.price, tier.currency)} {periodLabel(tier.period)}
      </p>
    </div>
  );
}

function AmountCell({ hire }: { hire: Hire }) {
  return <span className="whitespace-nowrap font-mono text-sm tabular text-white">{formatToken(hire.amount, hire.currency)}</span>;
}

function StatusCell({ hire }: { hire: Hire }) {
  const meta = HIRE_STATUS_META[hire.status];
  const accent = STATUS_ACCENT[hire.status];
  const dot =
    hire.status === 'active' ? (
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className={cn('absolute inline-flex h-full w-full animate-pulse-ring rounded-full', accent.bar)} />
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', accent.bar)} />
      </span>
    ) : (
      <span className={cn('h-1.5 w-1.5 rounded-full', accent.bar)} aria-hidden />
    );
  return (
    <Badge tone={meta.tone} icon={dot} title={meta.description} className="whitespace-nowrap">
      {meta.label}
    </Badge>
  );
}

function SlaCell({ hire }: { hire: Hire }) {
  const pct = clamp(hire.slaProgress, 0, 100);
  const accent = STATUS_ACCENT[hire.status];
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label="SLA progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1 min-w-[48px] flex-1 overflow-hidden rounded-full bg-white/[0.06]"
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500', accent.bar)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('shrink-0 font-mono text-[11px] tabular', accent.text)}>{pct}%</span>
    </div>
  );
}

function SourceCell({ resolved }: { resolved: ResolvedHire }) {
  const { hire } = resolved;
  if (hire.source !== 'a2a') {
    return (
      <div className="min-w-0">
        <Badge tone="slate" icon={<UserRound className="h-3 w-3" aria-hidden />}>
          Human
        </Badge>
        <p className="mt-1 truncate text-[11px] text-slate-500">Storefront checkout</p>
      </div>
    );
  }
  const caller = callerLabel(resolved) ?? 'External agent';
  return (
    <div className="min-w-0">
      <Badge tone="violet" icon={<Network className="h-3 w-3" aria-hidden />}>
        A2A
      </Badge>
      <p className="mt-1 truncate text-[11px] text-slate-500" title={hire.task ? `${caller} · ${hire.task}` : caller}>
        {caller}
        {hire.task ? (
          <>
            {' · '}
            <span className="font-mono text-slate-400">{hire.task}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

function DatesCell({ hire }: { hire: Hire }) {
  const expires = formatRelative(hire.expiresAt);
  const ended = hasEnded(expires);
  return (
    <div className="whitespace-nowrap">
      <p className="font-mono text-xs tabular text-slate-300">
        <time dateTime={hire.createdAt}>{formatRelative(hire.createdAt)}</time>
      </p>
      <p className={cn('font-mono text-[11px] tabular', ended ? 'text-slate-500' : 'text-slate-400')}>
        {ended ? 'Ended' : 'Ends'} <time dateTime={hire.expiresAt}>{expires}</time>
      </p>
    </div>
  );
}

function ExpandButton({
  open,
  panelId,
  label,
  onClick,
}: {
  open: boolean;
  panelId: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={open ? `Hide escrow details for ${label}` : `Show escrow details for ${label}`}
      className="ring-focus inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
    >
      <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
    </button>
  );
}

/* ---------------------------------- row ---------------------------------- */

export interface HireRowProps {
  resolved: ResolvedHire;
  /** `row` renders two <tr> elements for the md+ table, `card` a stacked mobile card. */
  variant: 'row' | 'card';
}

/** One hire, as a table row or a stacked card. Owns its own expanded state. */
export function HireRow({ resolved, variant }: HireRowProps) {
  const [open, setOpen] = useState(false);
  const { hire, agent } = resolved;
  const panelId = `hire-details-${hire.id}-${variant}`;
  const label = agent?.name ?? hire.agentId;
  const toggle = () => setOpen((v) => !v);

  if (variant === 'card') {
    return (
      <li className="glass overflow-hidden rounded-2xl shadow-card">
        <div className="flex items-start justify-between gap-3 p-4">
          <AgentCell resolved={resolved} />
          <StatusCell hire={hire} />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.06] px-4 py-3">
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Amount</dt>
            <dd className="mt-0.5">
              <AmountCell hire={hire} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Plan</dt>
            <dd className="mt-0.5">
              <PlanCell resolved={resolved} />
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">SLA progress</dt>
            <dd className="mt-1.5">
              <SlaCell hire={hire} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Source</dt>
            <dd className="mt-1">
              <SourceCell resolved={resolved} />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Created / Expires</dt>
            <dd className="mt-1">
              <DatesCell hire={hire} />
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="ring-focus flex w-full items-center justify-center gap-1.5 border-t border-white/[0.06] px-4 py-2.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          {open ? 'Hide escrow details' : 'Escrow details'}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
        </button>

        <div id={panelId} hidden={!open} className="border-t border-white/[0.06] p-3">
          {open && <HireDetails resolved={resolved} />}
        </div>
      </li>
    );
  }

  return (
    <>
      <tr className={cn('transition-colors hover:bg-white/[0.03]', open && 'bg-white/[0.03]')}>
        <td className={cn('px-4 py-3 align-middle', COL.agent)}>
          <AgentCell resolved={resolved} />
        </td>
        <td className={cn('px-4 py-3 align-middle', COL.plan)}>
          <PlanCell resolved={resolved} />
        </td>
        <td className={cn('px-4 py-3 align-middle', COL.amount)}>
          <AmountCell hire={hire} />
        </td>
        <td className={cn('px-4 py-3 align-middle', COL.status)}>
          <StatusCell hire={hire} />
        </td>
        <td className={cn('px-4 py-3 align-middle', COL.sla)}>
          <SlaCell hire={hire} />
        </td>
        <td className={cn('px-4 py-3 align-middle', COL.source)}>
          <SourceCell resolved={resolved} />
        </td>
        <td className={cn('px-4 py-3 align-middle', COL.dates)}>
          <DatesCell hire={hire} />
        </td>
        <td className={cn('px-4 py-3 align-middle', COL.actions)}>
          <ExpandButton open={open} panelId={panelId} label={label} onClick={toggle} />
        </td>
      </tr>
      <tr hidden={!open} className="bg-white/[0.02]">
        <td id={panelId} colSpan={HIRE_COLUMNS.length} className="px-4 pb-4 pt-0">
          {open && <HireDetails resolved={resolved} />}
        </td>
      </tr>
    </>
  );
}
