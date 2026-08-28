'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  CircleCheck,
  FlaskConical,
  Loader2,
  Lock,
  Minus,
  ScrollText,
  TriangleAlert,
  X,
} from '@/components/ui/icons';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import type { IndexedAgent } from '@/lib/types';
import { BSC_MAINNET, DEPLOYMENTS, PAYMENT_TOKEN_EIP712, type SupportedChainId } from '@/lib/chain/addresses';
import { Button } from '@/components/ui/button';
import { ConnectButton } from '@/components/wallet/connect-button';
import { EscrowStepper, type EscrowStepId } from '@/components/hire/escrow-stepper';
import { AgentAvatar } from '@/components/agents/agent-header';
import { CopyButton } from '@/components/agents/copy-button';
import { formatScore } from '@/components/agents/reputation-format';
import { bscScanAddress, cn, formatNumber, shortAddress } from '@/lib/utils';

/* --------------------------- deterministic ids -------------------------- */

function fnv1a(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A stable local reference for the drafted job. Derived, never random, so the
 * server and the client agree and re-opening the dialog shows the same string.
 * It is not a transaction hash and is not presented as one.
 */
function deriveJobRef(agentId: string) {
  const next = mulberry32(fnv1a(`bazar|job|${agentId}`));
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(next() * alphabet.length)];
  return `job_${out}`;
}

/* --------------------------------- steps -------------------------------- */

type Step = 'brief' | 'review' | 'funding' | 'success';

const STEP_TO_STAGE: Record<Step, EscrowStepId> = {
  brief: 'brief',
  review: 'fund',
  funding: 'fund',
  success: 'work',
};

/** Clearly-labelled simulation. No transaction is built, signed or broadcast. */
const FUND_PHASES = [
  { label: 'Awaiting signature', detail: 'In a wired build your wallet would ask you to approve the commitment.' },
  { label: 'Broadcasting', detail: 'The funding call would be submitted to a BNB Smart Chain RPC node.' },
  { label: 'Confirming', detail: 'The kernel would emit the job once the block finalises.' },
] as const;
const PHASE_DELAYS = [0, 1000, 2100];
const FUND_COMPLETE_MS = 3300;

const MAX_BRIEF = 500;

/* ------------------------------ focus utils ----------------------------- */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/* --------------------------------- rows --------------------------------- */

function SummaryRow({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-2',
        strong ? 'border-t border-white/[0.12] pt-3' : 'border-b border-white/[0.05] last:border-b-0',
      )}
    >
      <dt className={cn('shrink-0 text-xs', strong ? 'font-semibold text-white' : 'text-slate-500')}>{label}</dt>
      <dd
        className={cn(
          'flex min-w-0 items-center gap-1.5 text-right',
          strong ? 'text-sm font-semibold text-white' : 'text-xs text-slate-200',
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/* -------------------------------- modal --------------------------------- */

export interface HireModalProps {
  agent: IndexedAgent;
  open: boolean;
  onClose: () => void;
}

/**
 * Hire flow for an indexed ERC-8004 agent.
 *
 * There is no price anywhere in the registries, so this dialog never quotes
 * one: the hirer states their own budget and their own brief, and everything
 * else shown is a verified contract address from `lib/chain/addresses.ts`.
 * The funding step is a labelled simulation - Phase 2 wires it to the ERC-8183
 * commerce kernel.
 */
export function HireModal({ agent, open, onClose }: HireModalProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [step, setStep] = useState<Step>('brief');
  const [brief, setBrief] = useState('');
  const [budget, setBudget] = useState('');
  const [phase, setPhase] = useState(0);

  /* chain deployment for the agent's own network */
  const deployment = DEPLOYMENTS[agent.chainId as SupportedChainId] ?? DEPLOYMENTS[BSC_MAINNET];
  const targetChainId = deployment.chainId;

  /* wallet */
  const account = useAccount();
  const configChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const walletChainId = account.chainId ?? configChainId;
  const connected = mounted && account.status === 'connected' && Boolean(account.address);
  const onTargetChain = walletChainId === targetChainId;

  /* budget is the hirer's own number - nothing on chain quotes a price */
  const budgetValue = Number(budget);
  const budgetValid = Number.isFinite(budgetValue) && budgetValue > 0;
  const budgetDisplay = budgetValid ? formatNumber(budgetValue, { compact: false, decimals: 2 }) : '-';
  const jobRef = useMemo(() => deriveJobRef(agent.agentId), [agent.agentId]);

  const resetState = useCallback(() => {
    setStep('brief');
    setBrief('');
    setBudget('');
    setPhase(0);
  }, []);

  /* -------- simulated funding (see hook point below) -------- */
  useEffect(() => {
    if (step !== 'funding') return;
    setPhase(0);

    // ---------------------------------------------------------------------
    // HOOK POINT - real ERC-8183 job funding.
    // Replace this timer sequence with a wagmi write against
    // `deployment.agenticCommerce`, settling in `deployment.paymentToken`
    // (EIP-3009, domain PAYMENT_TOKEN_EIP712). Until that lands, Bazar
    // simulates and says so on screen.
    // ---------------------------------------------------------------------
    const timers = [
      ...PHASE_DELAYS.slice(1).map((delay, index) => setTimeout(() => setPhase(index + 1), delay)),
      setTimeout(() => setStep('success'), FUND_COMPLETE_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [step]);

  /* -------- escape + focus trap -------- */
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableIn(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = panelRef.current?.contains(active);
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  /* -------- move focus in, and back to the trigger on close -------- */
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, [open]);

  /* -------- body scroll lock -------- */
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  if (!mounted) return null;

  const transition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' as const };
  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 18, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 12, scale: 0.98 },
      };

  return createPortal(
    <AnimatePresence onExitComplete={resetState}>
      {open && (
        <motion.div
          key="bazar-hire-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4"
        >
          <div aria-hidden onClick={onClose} className="absolute inset-0 bg-ink/80 backdrop-blur-md" />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            {...panelMotion}
            transition={transition}
            className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/[0.12] bg-surface/95 shadow-card backdrop-blur-2xl sm:rounded-2xl"
          >
            {/* header */}
            <div className="flex shrink-0 items-start gap-3 border-b border-white/[0.08] p-4 sm:p-5">
              <AgentAvatar agent={agent} className="h-10 w-10 rounded-xl text-xs" />
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="truncate text-base font-semibold text-white">
                  Hire {agent.name}
                </h2>
                <p id={descriptionId} className="mt-0.5 text-xs text-slate-400">
                  Pricing is negotiated onchain via ERC-8183. The registries publish no price list, so Bazar quotes
                  none - you set the budget.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close hire dialog"
                className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white ring-focus"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* stepper */}
            <div className="shrink-0 border-b border-white/[0.08] px-4 py-3.5 sm:px-5">
              <EscrowStepper currentId={STEP_TO_STAGE[step]} />
            </div>

            {/* body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {step === 'brief' && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor={`${baseId}-brief`}
                      className="text-[11px] font-medium uppercase tracking-wider text-slate-500"
                    >
                      Brief
                    </label>
                    <textarea
                      id={`${baseId}-brief`}
                      value={brief}
                      onChange={(event) => setBrief(event.target.value.slice(0, MAX_BRIEF))}
                      rows={4}
                      placeholder="What should this agent do, and how will you know it worked?"
                      className="mt-2 w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-600 transition-colors hover:border-white/20 ring-focus"
                    />
                    <p className="tabular mt-1 text-right text-[10px] text-slate-600">
                      {brief.length} / {MAX_BRIEF}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor={`${baseId}-budget`}
                      className="text-[11px] font-medium uppercase tracking-wider text-slate-500"
                    >
                      Budget
                    </label>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        id={`${baseId}-budget`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={budget}
                        onChange={(event) => setBudget(event.target.value)}
                        placeholder="0.00"
                        aria-describedby={`${baseId}-budget-hint`}
                        className="tabular h-10 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white placeholder:text-slate-600 transition-colors hover:border-white/20 ring-focus"
                      />
                      <span className="shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                        {PAYMENT_TOKEN_EIP712.name}
                      </span>
                    </div>
                    <p id={`${baseId}-budget-hint`} className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                      Your number, not the agent&apos;s. ERC-8004 publishes identity and reputation only - no rate
                      card exists to quote from.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                    <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                      <ScrollText className="h-3.5 w-3.5" aria-hidden />
                      What this agent has published
                    </h3>
                    <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                        Reputation score{' '}
                        <span className="tabular font-semibold text-white">
                          {formatScore(agent.reputation.totalScore)} / 100
                        </span>
                      </li>
                      {/* The glyph has to agree with the sentence: a green tick
                          beside "no feedback recorded" reads as a pass mark for
                          an absence. Present facts tick, absences dash. */}
                      <li className="flex items-center gap-2">
                        {agent.reputation.totalFeedbacks > 0 ? (
                          <>
                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                            <span className="tabular font-semibold text-white">
                              {formatNumber(agent.reputation.totalFeedbacks, { compact: false })}
                            </span>
                            feedback {agent.reputation.totalFeedbacks === 1 ? 'entry' : 'entries'} on chain
                          </>
                        ) : (
                          <>
                            <Minus className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                            <span className="text-slate-400">No feedback recorded against this agent yet</span>
                          </>
                        )}
                      </li>
                      <li className="flex items-center gap-2">
                        {agent.protocols.length > 0 ? (
                          <>
                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                            <span>Declares {agent.protocols.join(', ')}</span>
                          </>
                        ) : (
                          <>
                            <Minus className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                            <span className="text-slate-400">No endpoint protocols declared</span>
                          </>
                        )}
                        {agent.x402 && <span className="text-slate-400">· x402 payments</span>}
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {step === 'review' && (
                <div className="space-y-4">
                  <dl>
                    <SummaryRow label="Agent">
                      <span className="truncate font-medium text-white">{agent.name}</span>
                      <span className="tabular shrink-0 font-mono text-slate-500">#{agent.tokenId}</span>
                    </SummaryRow>
                    {brief.trim() && (
                      <SummaryRow label="Brief">
                        <span className="line-clamp-2 text-slate-200">{brief.trim()}</span>
                      </SummaryRow>
                    )}
                    <SummaryRow label="Network">
                      <span>
                        {deployment.name} ({targetChainId})
                      </span>
                    </SummaryRow>
                    <SummaryRow label="Commerce kernel">
                      <a
                        href={bscScanAddress(deployment.agenticCommerce, targetChainId)}
                        target="_blank"
                        rel="noreferrer"
                        className="tabular truncate font-mono text-slate-200 transition-colors hover:text-bnb ring-focus"
                      >
                        {shortAddress(deployment.agenticCommerce)}
                      </a>
                      <CopyButton value={deployment.agenticCommerce} label="commerce kernel address" />
                    </SummaryRow>
                    <SummaryRow label="Settlement token">
                      <a
                        href={bscScanAddress(deployment.paymentToken, targetChainId)}
                        target="_blank"
                        rel="noreferrer"
                        className="tabular truncate font-mono text-slate-200 transition-colors hover:text-bnb ring-focus"
                      >
                        {shortAddress(deployment.paymentToken)}
                      </a>
                      <CopyButton value={deployment.paymentToken} label="settlement token address" />
                    </SummaryRow>
                    <SummaryRow label="Budget" strong>
                      <span className="tabular">
                        {budgetDisplay} {PAYMENT_TOKEN_EIP712.name}
                      </span>
                    </SummaryRow>
                  </dl>

                  <p className="flex items-start gap-2 rounded-xl border border-bnb/25 bg-bnb/[0.06] p-3 text-[11px] leading-relaxed text-slate-300">
                    <FlaskConical className="mt-px h-3.5 w-3.5 shrink-0 text-bnb" aria-hidden />
                    <span>
                      <span className="font-semibold text-bnb">Simulation.</span> The addresses above are the real
                      ERC-8183 deployment on {deployment.name}, but this build does not build, sign or broadcast a
                      transaction. Funding is wired in Phase 2.
                    </span>
                  </p>
                </div>
              )}

              {step === 'funding' && (
                <div className="py-2">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-bnb" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white" aria-live="polite">
                        {FUND_PHASES[phase].label}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{FUND_PHASES[phase].detail}</p>
                    </div>
                  </div>

                  <ol className="mt-5 space-y-2.5">
                    {FUND_PHASES.map((entry, index) => {
                      const done = index < phase;
                      const isCurrent = index === phase;
                      return (
                        <li key={entry.label} className="flex items-center gap-2.5 text-xs">
                          <span
                            aria-hidden
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                              done && 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300',
                              isCurrent && 'border-bnb/50 bg-bnb/15 text-bnb',
                              !done && !isCurrent && 'border-white/[0.12] bg-white/[0.03] text-slate-600',
                            )}
                          >
                            {done ? (
                              <Check className="h-3 w-3" aria-hidden />
                            ) : isCurrent ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            )}
                          </span>
                          <span className={cn(done || isCurrent ? 'text-slate-200' : 'text-slate-600')}>
                            {entry.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>

                  <p className="mt-5 flex items-start gap-2 rounded-xl border border-bnb/25 bg-bnb/[0.06] p-3 text-[11px] leading-relaxed text-slate-300">
                    <FlaskConical className="mt-px h-3.5 w-3.5 shrink-0 text-bnb" aria-hidden />
                    <span>
                      <span className="font-semibold text-bnb">Simulated sequence.</span> No wallet request is made and
                      nothing reaches the network.
                    </span>
                  </p>
                </div>
              )}

              {step === 'success' && (
                <div className="text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
                    <CircleCheck className="h-7 w-7 text-emerald-300" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-white">Job drafted</h3>
                  <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
                    A {budgetDisplay} {PAYMENT_TOKEN_EIP712.name} commitment to {agent.name} is ready to fund. Nothing
                    has been charged: the ERC-8183 call is wired in Phase 2.
                  </p>

                  <dl className="mt-5 text-left">
                    <SummaryRow label="Local reference">
                      <code className="truncate font-mono text-slate-200">{jobRef}</code>
                      <CopyButton value={jobRef} label="job reference" />
                    </SummaryRow>
                    <SummaryRow label="Agent ID">
                      <code className="truncate font-mono text-slate-200" title={agent.agentId}>
                        {agent.agentId}
                      </code>
                      <CopyButton value={agent.agentId} label="agent ID" />
                    </SummaryRow>
                  </dl>

                  <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                    The reference is generated in your browser so you can quote this draft. It is not a transaction
                    hash and does not exist on chain.
                  </p>
                </div>
              )}
            </div>

            {/* footer */}
            <div className="shrink-0 border-t border-white/[0.08] p-4 sm:p-5">
              {step === 'brief' && (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Budget</p>
                    <p className="tabular truncate text-sm font-semibold text-white">
                      {budgetDisplay} {budgetValid ? PAYMENT_TOKEN_EIP712.name : ''}
                    </p>
                  </div>
                  <Button type="button" onClick={() => setStep('review')} disabled={!budgetValid}>
                    Review terms
                  </Button>
                </div>
              )}

              {step === 'review' && (
                <div className="space-y-3">
                  {!connected ? (
                    <>
                      <ConnectButton fullWidth />
                      <p className="text-center text-[11px] leading-snug text-slate-500">
                        Connect a {deployment.name} wallet to continue.
                      </p>
                    </>
                  ) : !onTargetChain ? (
                    <>
                      <Button
                        type="button"
                        variant="danger"
                        className="w-full"
                        loading={isSwitching}
                        onClick={() => switchChain({ chainId: targetChainId })}
                        leftIcon={<TriangleAlert className="h-4 w-4" aria-hidden />}
                      >
                        Switch to {deployment.name}
                      </Button>
                      <p className="text-center text-[11px] leading-snug text-slate-500">
                        Your wallet is on chain {walletChainId}. This agent is registered on {deployment.name} (
                        {targetChainId}).
                      </p>
                    </>
                  ) : (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => setStep('funding')}
                      leftIcon={<Lock className="h-4 w-4" aria-hidden />}
                    >
                      Simulate funding
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setStep('brief')}
                    leftIcon={<ArrowLeft className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Back to the brief
                  </Button>
                </div>
              )}

              {step === 'funding' && (
                <p className="text-center text-[11px] text-slate-500">Keep this dialog open until the step finishes.</p>
              )}

              {step === 'success' && (
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <Button
                    href={bscScanAddress(deployment.agenticCommerce, targetChainId)}
                    external
                    variant="secondary"
                    className="w-full sm:flex-1"
                  >
                    View the kernel on BscScan
                  </Button>
                  <Button type="button" className="w-full sm:w-auto" onClick={onClose}>
                    Done
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
