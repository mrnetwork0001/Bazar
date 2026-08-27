import { ArrowUpRight, Gavel, HandCoins, Hourglass, Lock, Network, RotateCcw, ShieldCheck } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { BAZAR_ESCROW_ADDRESS } from '@/lib/constants';
import type { Hire } from '@/lib/types';
import { bscScanAddress, cn, formatRelative, formatToken, shortAddress } from '@/lib/utils';
import { callerLabel, resolveHire, shiftIso } from './hire-helpers';

export type EscrowEventKind = 'locked' | 'a2a' | 'sla-check' | 'sla-passed' | 'released' | 'refunded' | 'disputed';

export interface EscrowEvent {
  id: string;
  kind: EscrowEventKind;
  title: string;
  detail: string;
  /** ISO timestamp */
  at: string;
}

const KIND_META: Record<EscrowEventKind, { icon: typeof Lock; tone: string }> = {
  locked: { icon: Lock, tone: 'bg-bnb/15 text-bnb' },
  a2a: { icon: Network, tone: 'bg-violet-400/10 text-violet-300' },
  'sla-check': { icon: Hourglass, tone: 'bg-violet-400/10 text-violet-300' },
  'sla-passed': { icon: ShieldCheck, tone: 'bg-emerald-400/10 text-emerald-300' },
  released: { icon: HandCoins, tone: 'bg-emerald-400/10 text-emerald-300' },
  refunded: { icon: RotateCcw, tone: 'bg-rose-400/10 text-rose-300' },
  disputed: { icon: Gavel, tone: 'bg-rose-400/10 text-rose-300' },
};

/**
 * Derive escrow-contract events from the hire ledger. Every timestamp is
 * computed from the hire's own fixed ISO strings, so the feed is identical
 * on the server and the client.
 */
export function deriveEscrowEvents(hires: Hire[], limit = 9): EscrowEvent[] {
  const events: EscrowEvent[] = [];

  for (const hire of hires) {
    const resolved = resolveHire(hire);
    const name = resolved.agent?.name ?? hire.agentId;
    const amount = formatToken(hire.amount, hire.currency);
    const push = (kind: EscrowEventKind, title: string, detail: string, at: string) =>
      events.push({ id: `${hire.id}:${kind}`, kind, title, detail, at });

    if (hire.source === 'a2a') {
      const caller = callerLabel(resolved) ?? 'External agent';
      push('a2a', 'A2A call received', `${caller} → ${name}${hire.task ? ` · ${hire.task}` : ''}`, shiftIso(hire.createdAt, -2));
    }
    if (hire.status !== 'pending') {
      push('locked', 'Escrow locked', `${amount} · ${name}`, hire.createdAt);
    }

    switch (hire.status) {
      case 'sla-check':
        push('sla-check', 'SLA verification started', `${name} · ${hire.slaProgress}% of SLA reached`, shiftIso(hire.createdAt, 90));
        break;
      case 'released':
        push('sla-passed', 'SLA passed', `${name} · verified against on-chain telemetry`, hire.expiresAt);
        push('released', 'Payout released', `${amount} → ${name}`, shiftIso(hire.expiresAt, 4));
        break;
      case 'refunded':
        push('refunded', 'SLA missed — refunded', `${amount} returned · ${name}`, hire.expiresAt);
        break;
      case 'disputed':
        push('disputed', 'Dispute opened', `${name} · under validator review`, hire.expiresAt);
        break;
      default:
        break;
    }
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit);
}

export function ActivityFeed({ hires, className }: { hires: Hire[]; className?: string }) {
  const events = deriveEscrowEvents(hires);

  return (
    <GlassCard as="section" aria-labelledby="activity-heading" padded={false} className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div>
          <h2 id="activity-heading" className="text-sm font-semibold text-white">
            Escrow activity
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Events emitted by the Bazar escrow contract</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
          <span className="relative flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          BSC
        </span>
      </div>

      {events.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">No escrow events yet.</p>
      ) : (
        <ol className="divide-y divide-white/[0.06]">
          {events.map((event) => {
            const meta = KIND_META[event.kind];
            const Icon = meta.icon;
            return (
              <li key={event.id} className="flex items-start gap-3 px-5 py-3">
                <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', meta.tone)}>
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">{event.title}</p>
                  <p className="truncate text-xs text-slate-500" title={event.detail}>
                    {event.detail}
                  </p>
                </div>
                <time dateTime={event.at} className="shrink-0 pt-0.5 font-mono text-[11px] tabular text-slate-500">
                  {formatRelative(event.at)}
                </time>
              </li>
            );
          })}
        </ol>
      )}

      <a
        href={bscScanAddress(BAZAR_ESCROW_ADDRESS)}
        target="_blank"
        rel="noreferrer"
        className="ring-focus flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-xs text-slate-400 transition-colors hover:bg-white/[0.03] hover:text-white"
      >
        <span>
          Escrow contract <span className="font-mono text-slate-300">{shortAddress(BAZAR_ESCROW_ADDRESS)}</span>
        </span>
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </a>
    </GlassCard>
  );
}
