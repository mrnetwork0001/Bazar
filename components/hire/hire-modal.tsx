'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleCheck,
  Gauge,
  LayoutDashboard,
  Loader2,
  Lock,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import type { Agent } from '@/lib/types';
import { ESCROW_ABI } from '@/lib/a2a/escrow-abi';
import { BAZAR_ESCROW_ADDRESS, BSC_CHAIN_ID } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { ConnectButton } from '@/components/wallet/connect-button';
import { EscrowStepper, type EscrowStepId } from '@/components/hire/escrow-stepper';
import { TierPicker } from '@/components/hire/tier-picker';
import { CopyButton } from '@/components/agents/copy-button';
import { bscScanAddress, bscScanTx, cn, formatToken, periodLabel, shortAddress } from '@/lib/utils';

/* ------------------------------ escrow ABI ------------------------------ */

/**
 * Pulled from the shared ABI rather than re-declared, so the signature shown to
 * the user is always the one the contract call will actually use.
 */
const LOCK_ESCROW_FN = ESCROW_ABI.find(
  (entry): entry is Extract<(typeof ESCROW_ABI)[number], { type: 'function' }> =>
    entry.type === 'function' && entry.name === 'lockEscrow',
);
const LOCK_ESCROW_SIGNATURE = LOCK_ESCROW_FN
  ? `${LOCK_ESCROW_FN.name}(${LOCK_ESCROW_FN.inputs.map((input) => input.type).join(',')})`
  : 'lockEscrow';

/** Mirrors `PROTOCOL_FEE_BPS` in `lib/a2a/hire-service.ts` (1%). */
const PROTOCOL_FEE_BPS = 100;

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

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

function fromAlphabet(seed: string, length: number, alphabet: string) {
  const next = mulberry32(fnv1a(seed));
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(next() * alphabet.length)];
  return out;
}

/** Same shape as the ids minted by the A2A router, derived without randomness. */
function deriveHireId(agentId: string, tierId: string) {
  return `hire_${fromAlphabet(`bazar|hire|${agentId}|${tierId}`, 12, '0123456789ABCDEFGHJKMNPQRSTVWXYZ')}`;
}

function deriveTxHash(agentId: string, tierId: string) {
  return `0x${fromAlphabet(`bazar|tx|${agentId}|${tierId}`, 64, '0123456789abcdef')}`;
}

/* --------------------------------- steps -------------------------------- */

type Step = 'select' | 'review' | 'locking' | 'success';

const STEP_TO_ESCROW: Record<Step, EscrowStepId> = {
  select: 'select',
  review: 'lock',
  locking: 'lock',
  success: 'work',
};

/** Deterministic, simulated confirmation sequence (no transaction is sent). */
const LOCK_PHASES = [
  { label: 'Awaiting signature', detail: 'Confirm the escrow deposit in your wallet.', delay: 0 },
  { label: 'Broadcasting', detail: 'Submitting the transaction to a BSC RPC node.', delay: 1000 },
  { label: 'Confirming on BSC', detail: 'Waiting for the block to finalise.', delay: 2100 },
] as const;
const LOCK_COMPLETE_MS = 3300;

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

function SummaryRow({
  label,
  children,
  strong,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
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
  agent: Agent;
  open: boolean;
  onClose: () => void;
  /** Pre-select a tier; falls back to the recommended one. */
  defaultTierId?: string;
}

/**
 * Escrow hire flow: pick a plan, review the escrow terms, lock funds, done.
 *
 * The locking step is a deterministic simulation — Bazar never sends a
 * transaction from this build. See the clearly marked hook point in
 * `runLockSequence` for where the real `useWriteContract` call slots in.
 */
export function HireModal({ agent, open, onClose, defaultTierId }: HireModalProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const recommendedTierId = useMemo(
    () => agent.pricing.find((tier) => tier.recommended)?.id ?? agent.pricing[0]?.id ?? '',
    [agent.pricing],
  );
  const initialTierId = useMemo(
    () => (defaultTierId && agent.pricing.some((t) => t.id === defaultTierId) ? defaultTierId : recommendedTierId),
    [agent.pricing, defaultTierId, recommendedTierId],
  );

  const [step, setStep] = useState<Step>('select');
  const [tierId, setTierId] = useState(initialTierId);
  const [task, setTask] = useState('');
  const [brief, setBrief] = useState('');
  const [phase, setPhase] = useState(0);

  /* wallet */
  const account = useAccount();
  const configChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const chainId = account.chainId ?? configChainId;
  const connected = mounted && account.status === 'connected' && Boolean(account.address);
  const onBsc = chainId === BSC_CHAIN_ID;

  /* derived amounts */
  const tier = agent.pricing.find((t) => t.id === tierId) ?? agent.pricing[0];
  const price = tier?.price ?? 0;
  const currency = tier?.currency ?? 'BNB';
  const fee = round6((price * PROTOCOL_FEE_BPS) / 10_000);
  const total = round6(price + fee);
  const maxLatencyMs = Math.round(agent.metrics.avgResponseMs * 1.5);
  const hireId = deriveHireId(agent.id, tierId);
  const txHash = deriveTxHash(agent.id, tierId);

  /* keep the pre-selected tier in sync when the trigger changes */
  useEffect(() => {
    if (!open) return;
    setTierId((current) => (agent.pricing.some((t) => t.id === current) ? current : initialTierId));
  }, [open, initialTierId, agent.pricing]);

  const resetState = useCallback(() => {
    setStep('select');
    setTierId(initialTierId);
    setTask('');
    setBrief('');
    setPhase(0);
  }, [initialTierId]);

  /* -------- simulated escrow lock (see hook point below) -------- */
  useEffect(() => {
    if (step !== 'locking') return;
    setPhase(0);

    // ---------------------------------------------------------------------
    // HOOK POINT — real escrow lock.
    // Replace this timer sequence with the wagmi write below once the escrow
    // contract is deployed. The ABI and address are already wired:
    //
    //   const { writeContract, data: hash } = useWriteContract();
    //   writeContract({
    //     abi: ESCROW_ABI,                       // '@/lib/a2a/escrow-abi'
    //     address: BAZAR_ESCROW_ADDRESS,
    //     functionName: 'lockEscrow',            // LOCK_ESCROW_SIGNATURE
    //     args: [BigInt(agent.tokenId), hireIdToBytes32(hireId), account.address!, parseEther(String(total))],
    //     value: currency === 'BNB' ? parseEther(String(total)) : undefined,
    //   });
    //   // then drive `phase` from useWaitForTransactionReceipt({ hash }).
    // ---------------------------------------------------------------------
    const timers = [
      ...LOCK_PHASES.slice(1).map((entry, index) => setTimeout(() => setPhase(index + 1), entry.delay)),
      setTimeout(() => setStep('success'), LOCK_COMPLETE_MS),
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
      // Focus the dialog itself so its title and description are announced;
      // Tab then walks into the content in DOM order.
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
          <div
            aria-hidden
            onClick={onClose}
            className="absolute inset-0 bg-ink/80 backdrop-blur-md"
          />

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
              <span
                aria-hidden
                className={cn(
                  'flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white ring-1 ring-inset ring-white/20',
                  agent.avatar.gradient,
                )}
              >
                {agent.avatar.initials}
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="truncate text-base font-semibold text-white">
                  Hire {agent.name}
                </h2>
                <p id={descriptionId} className="mt-0.5 text-xs text-slate-400">
                  Funds are locked in the Bazar escrow on BNB Smart Chain and released only when the SLA is met.
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
              <EscrowStepper currentId={STEP_TO_ESCROW[step]} />
            </div>

            {/* body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {step === 'select' && (
                <div className="space-y-4">
                  <TierPicker tiers={agent.pricing} value={tierId} onChange={setTierId} name={`${baseId}-tier`} />

                  {agent.a2a.tasks.length > 0 && (
                    <div>
                      <label
                        htmlFor={`${baseId}-task`}
                        className="text-[11px] font-medium uppercase tracking-wider text-slate-500"
                      >
                        Task <span className="normal-case tracking-normal text-slate-600">(optional)</span>
                      </label>
                      <select
                        id={`${baseId}-task`}
                        value={task}
                        onChange={(event) => setTask(event.target.value)}
                        className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white transition-colors hover:border-white/20 ring-focus"
                      >
                        <option value="">Agent decides (default routine)</option>
                        {agent.a2a.tasks.map((taskName) => (
                          <option key={taskName} value={taskName}>
                            {taskName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor={`${baseId}-brief`}
                      className="text-[11px] font-medium uppercase tracking-wider text-slate-500"
                    >
                      Brief <span className="normal-case tracking-normal text-slate-600">(optional)</span>
                    </label>
                    <textarea
                      id={`${baseId}-brief`}
                      value={brief}
                      onChange={(event) => setBrief(event.target.value.slice(0, 500))}
                      rows={3}
                      placeholder="e.g. Watch my Venus BNB position and repay if the health factor drops below 1.4."
                      className="mt-2 w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-600 transition-colors hover:border-white/20 ring-focus"
                    />
                    <p className="mt-1 text-right text-[10px] tabular text-slate-600">{brief.length} / 500</p>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                    <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                      <Gauge className="h-3.5 w-3.5" aria-hidden />
                      SLA enforced by escrow
                    </h3>
                    <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                        Response <span className="tabular font-semibold text-white">≤ {maxLatencyMs} ms</span>
                        <span className="text-slate-500">(1.5× the agent&apos;s 30-day median)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                        Uptime <span className="tabular font-semibold text-white">≥ 99%</span>
                        <span className="text-slate-500">over the hire window</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                        Miss the terms and the escrow refunds you automatically
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
                    <SummaryRow label="Plan">
                      <span className="font-medium text-white">{tier?.name}</span>
                      <span className="text-slate-500">{tier ? periodLabel(tier.period) : null}</span>
                    </SummaryRow>
                    {task && (
                      <SummaryRow label="Task">
                        <code className="truncate font-mono text-slate-200">{task}</code>
                      </SummaryRow>
                    )}
                    <SummaryRow label="Amount">
                      <span className="tabular">{formatToken(price, currency)}</span>
                    </SummaryRow>
                    <SummaryRow label="Protocol fee">
                      <span className="tabular">
                        {formatToken(fee, currency)} <span className="text-slate-500">(1%)</span>
                      </span>
                    </SummaryRow>
                    <SummaryRow label="Network">
                      <span>BNB Smart Chain (56)</span>
                    </SummaryRow>
                    <SummaryRow label="Escrow contract">
                      <a
                        href={bscScanAddress(BAZAR_ESCROW_ADDRESS)}
                        target="_blank"
                        rel="noreferrer"
                        className="tabular truncate font-mono text-slate-200 transition-colors hover:text-bnb ring-focus"
                      >
                        {shortAddress(BAZAR_ESCROW_ADDRESS)}
                      </a>
                      <CopyButton value={BAZAR_ESCROW_ADDRESS} label="escrow contract address" />
                    </SummaryRow>
                    <SummaryRow label="Total" strong>
                      <span className="tabular">{formatToken(total, currency)}</span>
                    </SummaryRow>
                  </dl>

                  <p className="flex items-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-slate-400">
                    <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                    <span>
                      Calls{' '}
                      <code className="font-mono text-slate-300">{LOCK_ESCROW_SIGNATURE}</code>. Funds stay in the
                      contract until Bazar verifies the SLA against on-chain telemetry, then release to the agent or
                      refund to you.
                    </span>
                  </p>
                </div>
              )}

              {step === 'locking' && (
                <div className="py-2">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-bnb" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white" aria-live="polite">
                        {LOCK_PHASES[phase].label}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{LOCK_PHASES[phase].detail}</p>
                    </div>
                  </div>

                  <ol className="mt-5 space-y-2.5">
                    {LOCK_PHASES.map((entry, index) => {
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

                  <div className="mt-5 rounded-xl border border-white/[0.08] bg-ink/50 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Contract call</p>
                    <code className="mt-1.5 block break-all font-mono text-[11px] text-slate-300">
                      {LOCK_ESCROW_SIGNATURE}
                    </code>
                    <p className="mt-2 text-[11px] leading-snug text-slate-500">
                      Demo build — this sequence is simulated and no transaction is broadcast.
                    </p>
                  </div>
                </div>
              )}

              {step === 'success' && (
                <div className="text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
                    <CircleCheck className="h-7 w-7 text-emerald-300" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-white">Escrow locked</h3>
                  <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
                    {formatToken(total, currency)} is held for {agent.name}. Track SLA progress and auto-release from
                    your dashboard.
                  </p>

                  <dl className="mt-5 text-left">
                    <SummaryRow label="Hire ID">
                      <code className="truncate font-mono text-slate-200">{hireId}</code>
                      <CopyButton value={hireId} label="hire ID" />
                    </SummaryRow>
                    <SummaryRow label="Escrow tx">
                      <a
                        href={bscScanTx(txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono text-slate-200 transition-colors hover:text-bnb ring-focus"
                        title={txHash}
                      >
                        {shortAddress(txHash, 6)}
                      </a>
                      <CopyButton value={txHash} label="transaction hash" />
                      <ArrowUpRight className="h-3 w-3 shrink-0 text-slate-600" aria-hidden />
                    </SummaryRow>
                    <SummaryRow label="Plan">
                      <span>{tier?.name}</span>
                    </SummaryRow>
                  </dl>
                </div>
              )}
            </div>

            {/* footer */}
            <div className="shrink-0 border-t border-white/[0.08] p-4 sm:p-5">
              {step === 'select' && (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Total incl. 1% fee</p>
                    <p className="tabular truncate text-sm font-semibold text-white">{formatToken(total, currency)}</p>
                  </div>
                  <Button type="button" onClick={() => setStep('review')} disabled={!tier}>
                    Review escrow
                  </Button>
                </div>
              )}

              {step === 'review' && (
                <div className="space-y-3">
                  {!connected ? (
                    <>
                      <ConnectButton fullWidth />
                      <p className="text-center text-[11px] leading-snug text-slate-500">
                        Connect a BNB Smart Chain wallet to lock {formatToken(total, currency)} into escrow.
                      </p>
                    </>
                  ) : !onBsc ? (
                    <>
                      <Button
                        type="button"
                        variant="danger"
                        className="w-full"
                        loading={isSwitching}
                        onClick={() => switchChain({ chainId: BSC_CHAIN_ID })}
                        leftIcon={<TriangleAlert className="h-4 w-4" aria-hidden />}
                      >
                        Switch to BSC
                      </Button>
                      <p className="text-center text-[11px] leading-snug text-slate-500">
                        Your wallet is on chain {chainId}. Bazar escrow lives on BNB Smart Chain (56).
                      </p>
                    </>
                  ) : (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => setStep('locking')}
                      leftIcon={<Lock className="h-4 w-4" aria-hidden />}
                    >
                      Lock escrow · {formatToken(total, currency)}
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setStep('select')}
                    leftIcon={<ArrowLeft className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Back to plans
                  </Button>
                </div>
              )}

              {step === 'locking' && (
                <p className="text-center text-[11px] text-slate-500">
                  Keep this dialog open until the escrow is confirmed.
                </p>
              )}

              {step === 'success' && (
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <Button
                    href="/dashboard"
                    className="w-full sm:flex-1"
                    leftIcon={<LayoutDashboard className="h-4 w-4" aria-hidden />}
                  >
                    View in dashboard
                  </Button>
                  <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onClose}>
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
