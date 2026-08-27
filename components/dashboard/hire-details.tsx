'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Check, Copy, Gavel, Hourglass, RefreshCw, Timer, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HIRE_STATUS_META } from '@/lib/data/hires';
import { bscScanTx, cn, formatDate, formatToken, periodLabel, shortAddress } from '@/lib/utils';
import { EscrowTimeline } from './escrow-timeline';
import { callerLabel, type ResolvedHire } from './hire-helpers';

/* --------------------------------- copy --------------------------------- */

const NOTE_EXTEND =
  'Extensions unlock in the final 24 hours of the SLA window — until then the escrow contract holds the original terms.';
const NOTE_DISPUTE =
  'Disputes are escalated to the ERC-8004 validator set, which reviews the agent telemetry before escrow moves. Filing goes live with the mainnet escrow contract.';
const NOTE_CLIPBOARD = 'Clipboard is unavailable in this browser — select the hire id to copy it manually.';

/* ------------------------------- fragments ------------------------------- */

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-2 last:border-0">
      <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-xs text-slate-300">{children}</dd>
    </div>
  );
}

function TxLink({ hash, label, pending }: { hash?: string; label: string; pending: string }) {
  if (!hash) return <span className="text-slate-500">{pending}</span>;
  return (
    <a
      href={bscScanTx(hash)}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} on BscScan`}
      className="ring-focus inline-flex items-center gap-1 rounded font-mono text-xs text-bnb transition-colors hover:text-bnb-300"
    >
      {shortAddress(hash, 6)}
      <ArrowUpRight className="h-3 w-3" aria-hidden />
    </a>
  );
}

/* -------------------------------- details -------------------------------- */

export interface HireDetailsProps {
  resolved: ResolvedHire;
  className?: string;
}

/**
 * Expanded panel for a single hire: on-chain references, the escrow lifecycle
 * timeline and the actions available in the hire's current state.
 *
 * Every action is a local no-op that surfaces an inline note — nothing here
 * signs a transaction until the escrow contract is deployed.
 */
export function HireDetails({ resolved, className }: HireDetailsProps) {
  const { hire, agent, tier } = resolved;
  const meta = HIRE_STATUS_META[hire.status];
  const caller = callerLabel(resolved);

  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copyId() {
    try {
      await navigator.clipboard.writeText(hire.id);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setNote(NOTE_CLIPBOARD);
    }
  }

  return (
    <div className={cn('rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5', className)}>
      {/* lifecycle */}
      <section aria-label="Escrow lifecycle">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Escrow lifecycle</h4>
          <p className="text-xs text-slate-500">{meta.description}</p>
        </div>
        <EscrowTimeline status={hire.status} className="mt-4" />
      </section>

      <div className="mt-5 grid gap-5 border-t border-white/[0.06] pt-5 md:grid-cols-[minmax(0,1fr)_minmax(0,240px)] md:gap-6">
        {/* on-chain references */}
        <dl className="min-w-0">
          <Row label="Hire id">
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono text-xs text-slate-200">{hire.id}</span>
              <button
                type="button"
                onClick={copyId}
                aria-label={copied ? 'Hire id copied' : `Copy hire id ${hire.id}`}
                className="ring-focus rounded-md p-1 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
              <span aria-live="polite" className="sr-only">
                {copied ? 'Copied to clipboard' : ''}
              </span>
            </span>
          </Row>
          <Row label="Escrow tx">
            <TxLink hash={hire.escrowTx} label="Escrow transaction" pending="Awaiting deposit" />
          </Row>
          <Row label="Release tx">
            <TxLink
              hash={hire.releaseTx}
              label={hire.status === 'refunded' ? 'Refund transaction' : 'Release transaction'}
              pending={hire.status === 'refunded' ? 'Refund pending' : 'Releases after SLA verification'}
            />
          </Row>
          <Row label="Plan">
            {tier ? (
              <span>
                {tier.name}
                <span className="text-slate-500">
                  {' · '}
                  <span className="font-mono tabular">{formatToken(tier.price, tier.currency)}</span> {periodLabel(tier.period)}
                </span>
              </span>
            ) : (
              <span className="font-mono text-slate-400">{hire.tierId}</span>
            )}
          </Row>
          <Row label="Escrowed">
            <span className="font-mono tabular text-white">{formatToken(hire.amount, hire.currency)}</span>
          </Row>
          <Row label="Source">
            {hire.source === 'a2a' ? (
              <span>
                A2A router
                <span className="text-slate-500">
                  {' · '}
                  {caller ?? 'External agent'}
                  {hire.task ? (
                    <>
                      {' · '}
                      <span className="font-mono">{hire.task}</span>
                    </>
                  ) : null}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                Hired from the storefront
              </span>
            )}
          </Row>
          <Row label="Window">
            <span className="font-mono tabular text-slate-400">
              {formatDate(hire.createdAt)} → {formatDate(hire.expiresAt)}
            </span>
          </Row>
        </dl>

        {/* actions */}
        <div className="min-w-0">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {hire.status === 'sla-check' && (
              <Button
                size="sm"
                variant="secondary"
                disabled
                aria-disabled="true"
                title="Bazar is verifying SLA terms against on-chain telemetry"
                leftIcon={<Hourglass className="h-3.5 w-3.5" aria-hidden />}
              >
                Awaiting verification
              </Button>
            )}

            {hire.status === 'active' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNote(NOTE_EXTEND)}
                  leftIcon={<Timer className="h-3.5 w-3.5" aria-hidden />}
                >
                  Extend
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setNote(NOTE_DISPUTE)}
                  leftIcon={<Gavel className="h-3.5 w-3.5" aria-hidden />}
                >
                  Open dispute
                </Button>
              </>
            )}

            {hire.status === 'released' && agent && (
              <Button size="sm" href={`/agents/${agent.id}`} leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}>
                Rehire
              </Button>
            )}

            {hire.status !== 'released' && agent && (
              <Button size="sm" variant="secondary" href={`/agents/${agent.id}`}>
                View agent
              </Button>
            )}
          </div>

          <p role="status" className="mt-3 text-[11px] leading-relaxed text-slate-500">
            {note ?? 'Escrow moves only when the SLA check settles. Bazar never holds custody of your funds.'}
          </p>
        </div>
      </div>
    </div>
  );
}
