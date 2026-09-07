'use client';

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { useAccount, useBlock, useChainId, useSwitchChain } from 'wagmi';

import {
  Check,
  CircleCheck,
  Coins,
  ExternalLink,
  Hourglass,
  Loader2,
  Lock,
  Minus,
  ShieldCheck,
  TriangleAlert,
  Vault,
  Wallet,
} from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConnectButton } from '@/components/wallet/connect-button';
import { CopyButton } from '@/components/agents/copy-button';
import { AltanaHirePanel } from '@/components/hire/altana-hire-panel';
import { EscrowStepper, type EscrowStepId } from '@/components/hire/escrow-stepper';
import { BSC_MAINNET, getDeployment, type SupportedChainId } from '@/lib/chain/addresses';
import { formatBudget, PAYMENT_TOKEN_SYMBOL } from '@/lib/jobs/read';
import type { Address, IndexedAgent } from '@/lib/types';
import { bscScanAddress, bscScanTx, cn, shortAddress } from '@/lib/utils';
import {
  DEFAULT_DURATION_ID,
  durationById,
  formatChainTimestamp,
  formatSeconds,
  HIRE_CHAIN_META,
  HIRE_DURATIONS,
  isSupportedHireChain,
} from './hire-networks';
import {
  useAgentProvider,
  useKernelPaused,
  usePaymentTokenMeta,
  usePaymentTokenPosition,
  useSettlementPolicy,
} from './use-hire-reads';
import { useHireRun, type HireStepId, type HireStepState } from './use-hire-run';

/* ------------------------------------------------------------------ */
/* Phases                                                              */
/* ------------------------------------------------------------------ */

type Phase = 'brief' | 'review' | 'settling' | 'settled';

const PHASE_TO_STAGE: Record<Phase, EscrowStepId> = {
  brief: 'brief',
  review: 'fund',
  settling: 'fund',
  settled: 'work',
};

const MAX_BRIEF = 500;

const STEP_COPY: Record<HireStepId, { title: string; what: string }> = {
  create: {
    title: 'Create the job',
    what: 'createJob writes the brief, the provider, the evaluator and the deadline onto the kernel. No funds move.',
  },
  register: {
    title: 'Register the settlement policy',
    what: 'registerJob points the EvaluatorRouter at the OptimisticPolicy for this job. Without it, fund reverts PolicyNotSet.',
  },
  budget: {
    title: 'Record the budget',
    what: 'setBudget stores the amount onchain. fund reverts ZeroBudget without it, and BudgetMismatch if it disagrees.',
  },
  approve: {
    title: 'Approve the kernel',
    what: 'fund moves your U with transferFrom, so the token has to allow it. Approved for exactly the budget.',
  },
  fund: {
    title: 'Fund the escrow',
    what: 'fund transfers the budget from your wallet into the kernel, where it is held until the job settles.',
  },
};

const STEP_STATUS_LABEL: Record<HireStepState['status'], string> = {
  idle: 'Waiting',
  simulating: 'Checking against the chain',
  'awaiting-signature': 'Awaiting your signature',
  confirming: 'Broadcast - waiting for a block',
  confirmed: 'Confirmed onchain',
  skipped: 'Not needed',
  failed: 'Did not complete',
};

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 py-2',
        strong ? 'border-t border-white/[0.12] pt-3' : 'border-b border-white/[0.05] last:border-b-0',
      )}
    >
      <dt className={cn('shrink-0 text-xs', strong ? 'font-semibold text-white' : 'text-slate-500')}>{label}</dt>
      <dd
        className={cn(
          'flex min-w-0 items-center justify-end gap-1.5 text-right',
          strong ? 'text-sm font-semibold text-white' : 'text-xs text-slate-200',
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function AddressLink({ address, chainId }: { address: Address; chainId: number }) {
  return (
    <>
      <a
        href={bscScanAddress(address, chainId)}
        target="_blank"
        rel="noreferrer"
        className="tabular ring-focus truncate font-mono text-slate-200 transition-colors hover:text-bnb"
      >
        {shortAddress(address)}
      </a>
      <CopyButton value={address} label="address" />
    </>
  );
}

function TxLink({ hash, chainId, label }: { hash: string; chainId: number; label: string }) {
  return (
    <a
      href={bscScanTx(hash, chainId)}
      target="_blank"
      rel="noreferrer"
      className="ring-focus inline-flex items-center gap-1 font-mono text-[11px] text-slate-400 transition-colors hover:text-bnb"
    >
      {label} {shortAddress(hash, 6)}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: 'gold' | 'rose' | 'slate';
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-xl border p-3 text-[11px] leading-relaxed',
        tone === 'gold' && 'border-bnb/25 bg-bnb/[0.06] text-slate-300',
        tone === 'rose' && 'border-rose-500/30 bg-rose-500/[0.07] text-rose-100',
        tone === 'slate' && 'border-white/[0.08] bg-white/[0.02] text-slate-400',
      )}
    >
      <span className="mt-px shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Flow                                                                */
/* ------------------------------------------------------------------ */

export interface HireFlowProps {
  agent: IndexedAgent;
  onClose: () => void;
  /** Bumped by the dialog when it closes, so the flow can clear itself. */
  resetKey: number;
}

/**
 * The hire flow, wired to the live ERC-8183 kernel.
 *
 * Everything on screen is either something the hirer typed or something read
 * from the chain. There is no simulated state left in this component: the
 * former three-phase timer that pretended to broadcast has been replaced by
 * four real transactions, each of which is checked with `eth_call` before the
 * wallet is asked to sign it, and none of which is reported as done until its
 * receipt confirms.
 */
export function HireFlow({ agent, onClose, resetKey }: HireFlowProps) {
  const baseId = useId();
  const account = useAccount();
  const configChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  /* ---------------- form ---------------- */
  const [phase, setPhase] = useState<Phase>('brief');
  const [brief, setBrief] = useState('');
  const [budgetText, setBudgetText] = useState('');
  const [durationId, setDurationId] = useState<string>(DEFAULT_DURATION_ID);

  /**
   * Which kernel to settle against.
   *
   * Mainnet only, because a hirer who has not connected a wallet yet is
   * almost certainly rehearsing and testnet settles in minutes where mainnet
   * takes a week. Once a wallet is connected on a supported chain the selector
   * adopts it, so a deliberate mainnet hire is never met with a pointless
   * network switch. Touching the selector ends the adoption for good - an
   * explicit choice outranks both.
   */
  const walletChainId = account.chainId ?? configChainId;

  /**
   * The settlement chain is NOT a free choice: it is the chain the agent's
   * identity is attested on.
   *
   * An ERC-8004 token id means different things on different networks. Token
   * 1776 resolves to 0x3C005172... on testnet and 0xFC619f08... on mainnet, so
   * funding a testnet-registered agent through the mainnet kernel would send
   * real U to an address the mainnet registry has never vouched for, and the
   * agent the user meant to hire would have no claim on it. Every provider
   * guard still passes in that case, because the lookup succeeds perfectly
   * against the wrong chain.
   */
  const chainId: SupportedChainId = BSC_MAINNET;


  const { state: run, run: startRun, reset: resetRun } = useHireRun();

  useEffect(() => {
    setPhase('brief');
    setBrief('');
    setBudgetText('');
    setDurationId(DEFAULT_DURATION_ID);
    resetRun();
  }, [resetKey, resetRun]);

  /* ---------------- chain reads ---------------- */
  const deployment = getDeployment(chainId);
  const chainMeta = HIRE_CHAIN_META[chainId];
  const provider = useAgentProvider(agent);
  const tokenState = usePaymentTokenPosition(chainId, account.address);
  const policy = useSettlementPolicy(chainId);
  const paused = useKernelPaused(chainId);
  const { data: headBlock } = useBlock({ chainId, blockTag: 'latest', query: { staleTime: 30_000 } });

  // Read from the token contract, not from the wallet: a disconnected reader
  // needs decimals to parse a budget, and without them `canReview` was false
  // and the brief step could not be left at all.
  const tokenMeta = usePaymentTokenMeta(chainId);
  const symbol = tokenMeta.status === 'ready' ? tokenMeta.meta.symbol : PAYMENT_TOKEN_SYMBOL;
  const decimals = tokenMeta.status === 'ready' ? tokenMeta.meta.decimals : null;

  /* ---------------- budget ---------------- */
  const budget = useMemo(() => {
    const text = budgetText.trim();
    if (!text) return { wei: null as bigint | null, error: null as string | null };
    if (decimals === null) return { wei: null, error: null };
    if (!/^\d*\.?\d*$/.test(text) || text === '.') {
      return { wei: null, error: 'Enter a plain decimal amount.' };
    }
    const fraction = text.split('.')[1] ?? '';
    if (fraction.length > decimals) {
      return { wei: null, error: `${symbol} has ${decimals} decimals; that is more precision than the token has.` };
    }
    try {
      const wei = parseUnits(text, decimals);
      if (wei <= 0n) return { wei: null, error: 'The budget has to be more than zero.' };
      return { wei, error: null };
    } catch {
      return { wei: null, error: 'That is not an amount this token can hold.' };
    }
  }, [budgetText, decimals, symbol]);

  const balance = tokenState.status === 'ready' ? tokenState.position.balance : null;
  const overBalance = budget.wei !== null && balance !== null && budget.wei > balance;
  const noBalance = balance !== null && balance === 0n;

  const duration = durationById(durationId);
  const expiresAt =
    headBlock?.timestamp !== undefined ? Number(headBlock.timestamp) + duration.seconds : null;

  const connected = account.status === 'connected' && Boolean(account.address);
  const onTargetChain = walletChainId === chainId;
  const briefReady = brief.trim().length > 0;

  const blockingReason = useMemo<string | null>(() => {
    if (paused === 'paused') return `The ${chainMeta.name} kernel is paused. No job can be created or funded on it.`;
    if (provider.status === 'refused') return provider.reason;
    if (tokenMeta.status === 'error')
      return `The settlement token could not be read on ${chainMeta.name}, so Bazar cannot tell what a budget in it means. Nothing here is safe to sign until it answers.`;
    if (tokenState.status === 'error')
      return `The ${symbol} balance for this wallet could not be read on ${chainMeta.name}, so Bazar cannot tell whether this budget is fundable.`;
    return null;
  }, [chainMeta.name, paused, provider, symbol, tokenMeta.status, tokenState.status]);

  const canReview =
    briefReady && budget.wei !== null && !budget.error && !overBalance && !blockingReason && !noBalance;

  /**
   * The balance can only be read once a wallet is connected, so a hirer can
   * legitimately reach the review screen with it unknown. Re-check it here: a
   * budget larger than the balance would create the job and only fail at the
   * last step, leaving an orphan job behind. Nothing is signed until the chain
   * says the whole sequence can finish.
   */
  const fundable =
    tokenState.status === 'ready' && budget.wei !== null && tokenState.position.balance >= budget.wei;

  /* ---------------- launch ---------------- */
  const launch = useCallback(() => {
    if (provider.status !== 'resolved' || budget.wei === null || !account.address) return;
    setPhase('settling');
    void startRun({
      chainId,
      client: account.address,
      provider: provider.address,
      evaluator: deployment.evaluatorRouter,
      description: brief.trim(),
      durationSeconds: duration.seconds,
      budgetWei: budget.wei,
      agentSlug: agent.slug,
      agentName: agent.name,
    });
  }, [
    account.address,
    agent.name,
    agent.slug,
    brief,
    budget.wei,
    chainId,
    deployment.evaluatorRouter,
    duration.seconds,
    provider,
    startRun,
  ]);

  useEffect(() => {
    if (run.settled) setPhase('settled');
  }, [run.settled]);

  const failedStep = run.steps.find((s) => s.status === 'failed') ?? null;
  const activeStatus = run.activeStep
    ? (run.steps.find((s) => s.id === run.activeStep)?.status ?? null)
    : null;
  // A skipped step is a real outcome and is shown as one - except when it was
  // skipped before the sequence ever touched it, which only happens when the
  // chain already satisfied it and there is nothing for the user to know.
  const visibleSteps = run.steps.filter(
    (s) => !((s.id === 'approve' || s.id === 'register') && s.status === 'skipped'),
  );

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <>
      <div className="shrink-0 border-b border-white/[0.08] px-4 py-3.5 sm:px-5">
        <EscrowStepper currentId={PHASE_TO_STAGE[phase]} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {phase === 'brief' && (
          <div className="space-y-5">
            {/* network - determined by where the agent's identity is attested */}
            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Settles on</h3>
              <div className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">{chainMeta.name}</span>
                  <Badge tone={chainMeta.liveFunds ? 'gold' : 'slate'}>
                    {chainMeta.liveFunds ? 'Real funds' : 'Test funds'}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{chainMeta.stake}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  This is not a choice. {agent.name} holds ERC-8004 token #{agent.tokenId} on {chainMeta.name},
                  and that is the only network whose registry vouches for the wallet the escrow pays. Settling
                  elsewhere would pay whoever happens to hold the same token id on that other chain.
                </p>
              </div>
            </section>

            {/* brief */}
            <section>
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
                rows={3}
                placeholder="What should this agent do, and how will you know it worked?"
                className="ring-focus mt-2 w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white transition-colors placeholder:text-slate-600 hover:border-white/20"
              />
              <p className="tabular mt-1 flex justify-between text-[10px] text-slate-600">
                <span>Written onchain as the job description, in public.</span>
                <span>
                  {brief.length} / {MAX_BRIEF}
                </span>
              </p>
            </section>

            {/* budget */}
            <section>
              <div className="flex items-baseline justify-between gap-2">
                <label
                  htmlFor={`${baseId}-budget`}
                  className="text-[11px] font-medium uppercase tracking-wider text-slate-500"
                >
                  Budget
                </label>
                {tokenState.status === 'ready' && (
                  <button
                    type="button"
                    onClick={() => setBudgetText(formatUnits(tokenState.position.balance, decimals ?? 18))}
                    className="ring-focus tabular rounded text-[11px] text-slate-500 transition-colors hover:text-bnb"
                  >
                    Balance {formatBudget(tokenState.position.balance, tokenState.position.decimals)} {symbol}
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id={`${baseId}-budget`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={budgetText}
                  onChange={(event) => setBudgetText(event.target.value)}
                  placeholder="0.00"
                  aria-describedby={`${baseId}-budget-hint`}
                  className="tabular ring-focus h-10 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white transition-colors placeholder:text-slate-600 hover:border-white/20"
                />
                <span className="shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300">
                  {symbol}
                </span>
              </div>
              <p id={`${baseId}-budget-hint`} className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                The kernel settles in {symbol} at{' '}
                <a
                  href={bscScanAddress(deployment.paymentToken, chainId)}
                  target="_blank"
                  rel="noreferrer"
                  className="ring-focus font-mono text-slate-400 transition-colors hover:text-bnb"
                >
                  {shortAddress(deployment.paymentToken)}
                </a>
                , not in BNB. BNB is only spent on gas. No registry publishes a rate card, so this figure is yours.
              </p>

              {budget.error && (
                <p className="mt-2 text-[11px] text-rose-300">{budget.error}</p>
              )}
              {tokenState.status === 'loading' && (
                <p className="mt-2 text-[11px] text-slate-500">Reading your {symbol} balance on {chainMeta.name}.</p>
              )}
              {noBalance && (
                <div className="mt-2">
                  <Notice tone="rose" icon={<TriangleAlert className="h-3.5 w-3.5" />}>
                    This wallet holds no {symbol} on {chainMeta.name}. Funding a job moves {symbol} from your wallet
                    into the kernel, so it cannot proceed until this wallet holds some. Bazar does not know where you
                    get it and will not point you at a faucet it has not verified.
                  </Notice>
                </div>
              )}
              {overBalance && !noBalance && balance !== null && (
                <p className="mt-2 text-[11px] text-rose-300">
                  That is more than this wallet holds. The balance is {formatBudget(balance, decimals ?? 18)} {symbol}.
                </p>
              )}
            </section>

            {/* deadline */}
            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Deadline</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {HIRE_DURATIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDurationId(option.id)}
                    aria-pressed={option.id === durationId}
                    className={cn(
                      'ring-focus rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                      option.id === durationId
                        ? 'border-bnb/50 bg-bnb/10 text-bnb'
                        : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                {duration.note}{' '}
                {expiresAt !== null ? (
                  <>
                    Written onchain as <span className="tabular text-slate-300">{formatChainTimestamp(expiresAt)}</span>,
                    computed from the current head block and recomputed the moment you sign.
                  </>
                ) : (
                  <>The exact instant is computed from the head block when you sign.</>
                )}
              </p>
            </section>

            {blockingReason && (
              <Notice tone="rose" icon={<TriangleAlert className="h-3.5 w-3.5" />}>
                {blockingReason}
              </Notice>
            )}
          </div>
        )}

        {phase === 'review' && (
          <div className="space-y-4">
            <dl>
              <Row label="Agent">
                <span className="truncate font-medium text-white">{agent.name}</span>
                <span className="tabular shrink-0 font-mono text-slate-500">#{agent.tokenId}</span>
              </Row>
              <Row label="Pays">
                {provider.status === 'resolved' ? (
                  <AddressLink address={provider.address} chainId={provider.registryChainId} />
                ) : (
                  <span className="text-rose-300">unresolved</span>
                )}
              </Row>
              <Row label="Brief">
                <span className="line-clamp-3 text-left text-slate-200">{brief.trim()}</span>
              </Row>
              <Row label="Network">
                <span>
                  {chainMeta.name} ({chainId})
                </span>
              </Row>
              <Row label="Kernel">
                <AddressLink address={deployment.agenticCommerce} chainId={chainId} />
              </Row>
              <Row label="Evaluator and hook">
                <AddressLink address={deployment.evaluatorRouter} chainId={chainId} />
              </Row>
              <Row label="Deadline">
                <span className="tabular">
                  {expiresAt !== null ? formatChainTimestamp(expiresAt) : `${duration.label} from signing`}
                </span>
              </Row>
              <Row label="Budget" strong>
                <span className="tabular">
                  {budget.wei !== null ? formatBudget(budget.wei, decimals ?? 18) : '-'} {symbol}
                </span>
              </Row>
            </dl>

            {provider.status === 'resolved' && (
              <p className="text-[11px] leading-relaxed text-slate-500">
                The address above was read from the ERC-8004 Identity Registry at{' '}
                <span className="font-mono">{shortAddress(provider.registry)}</span> on chain{' '}
                {provider.registryChainId}, via{' '}
                <span className="font-mono">
                  {provider.source === 'agent-wallet' ? 'getAgentWallet' : 'ownerOf'}
                </span>
                . On completion the kernel releases the escrow to it.
              </p>
            )}

            {/* The settlement chain is pinned to the agent's registry chain, so a
                mismatch between the two is unreachable. This is where it used to
                render as "this is a rehearsal" - which, on a mainnet hire of a
                testnet-registered agent, told the user real funds were test funds. */}

            <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                What your wallet will be asked to sign
              </h3>
              <ol className="mt-2 space-y-2">
                {run.steps.map((step, index) => {
                  const skippable =
                    step.id === 'approve' &&
                    tokenState.status === 'ready' &&
                    budget.wei !== null &&
                    tokenState.position.allowance >= budget.wei;
                  return (
                    <li key={step.id} className="flex gap-2.5 text-xs">
                      <span
                        aria-hidden
                        className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-[10px] font-semibold text-slate-400"
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className={cn('font-medium', skippable ? 'text-slate-500' : 'text-slate-200')}>
                          {STEP_COPY[step.id].title}
                          {skippable && ' - already allowed, this one will be skipped'}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                          {STEP_COPY[step.id].what}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <Notice
              tone={chainMeta.liveFunds ? 'rose' : 'gold'}
              icon={chainMeta.liveFunds ? <TriangleAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            >
              {chainMeta.liveFunds ? (
                <>
                  <span className="font-semibold">This is BNB Smart Chain.</span> The budget leaves your wallet for
                  real and the kernel holds it until the job settles.{' '}
                  {policy.status === 'ready' && (
                    <>
                      Settlement here needs {policy.policy.voteQuorum} evaluator votes and a{' '}
                      {formatSeconds(policy.policy.disputeWindow)} dispute window.
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="font-semibold">This is BSC Testnet.</span> The transactions, the kernel and the
                  escrow are real; the money is not.{' '}
                  {policy.status === 'ready' && (
                    <>
                      Settlement needs {policy.policy.voteQuorum} evaluator vote
                      {policy.policy.voteQuorum === 1 ? '' : 's'} and a{' '}
                      {formatSeconds(policy.policy.disputeWindow)} dispute window.
                    </>
                  )}
                </>
              )}
            </Notice>

            {/* The delegated route. Rendered alongside the wallet route, never
                instead of it: a session key is an option a hirer has set up in
                advance on /permissions, and the panel says so plainly when
                there is none. It disappears entirely for a browser with no
                Altana wallet. */}
            <AltanaHirePanel
              agent={agent}
              provider={provider.status === 'resolved' ? provider.address : null}
              brief={brief}
              budgetWei={budget.wei}
              deadlineSeconds={duration.seconds}
            />
          </div>
        )}

        {(phase === 'settling' || phase === 'settled') && (
          <div className="space-y-4">
            {phase === 'settled' && (
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
                  <CircleCheck className="h-7 w-7 text-emerald-300" aria-hidden />
                </span>
                <h3 className="mt-3 text-lg font-semibold text-white">Escrow funded</h3>
                <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
                  Job <span className="tabular font-semibold text-white">#{run.jobId?.toString()}</span> on{' '}
                  {chainMeta.name} is holding {budget.wei !== null ? formatBudget(budget.wei, decimals ?? 18) : '-'}{' '}
                  {symbol} for {agent.name}. Every hash below is a real transaction.
                </p>
              </div>
            )}

            {run.jobId !== null && (
              <dl className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3">
                <Row label="Job id">
                  <span className="tabular font-mono text-white">#{run.jobId.toString()}</span>
                  <CopyButton value={run.jobId.toString()} label="job id" />
                </Row>
                <Row label="Kernel">
                  <AddressLink address={deployment.agenticCommerce} chainId={chainId} />
                </Row>
              </dl>
            )}

            <ol className="space-y-2.5">
              {visibleSteps.map((step) => {
                const active = run.activeStep === step.id;
                const done = step.status === 'confirmed' || step.status === 'skipped';
                const bad = step.status === 'failed';
                return (
                  <li
                    key={step.id}
                    className={cn(
                      'rounded-xl border p-3',
                      bad
                        ? 'border-rose-500/30 bg-rose-500/[0.06]'
                        : done
                          ? 'border-emerald-400/20 bg-emerald-400/[0.04]'
                          : active
                            ? 'border-bnb/40 bg-bnb/[0.05]'
                            : 'border-white/[0.08] bg-white/[0.02]',
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className={cn(
                          'mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                          bad && 'border-rose-400/40 bg-rose-400/15 text-rose-300',
                          done && 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300',
                          !bad && !done && active && 'border-bnb/50 bg-bnb/15 text-bnb',
                          !bad && !done && !active && 'border-white/[0.12] bg-white/[0.03] text-slate-600',
                        )}
                      >
                        {done ? (
                          step.status === 'skipped' ? (
                            <Minus className="h-3 w-3" aria-hidden />
                          ) : (
                            <Check className="h-3 w-3" aria-hidden />
                          )
                        ) : bad ? (
                          <TriangleAlert className="h-3 w-3" aria-hidden />
                        ) : active ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                          <span className={cn('font-semibold', done || active || bad ? 'text-white' : 'text-slate-500')}>
                            {STEP_COPY[step.id].title}
                          </span>
                          <span
                            aria-live={active ? 'polite' : undefined}
                            className={cn(
                              'text-[11px]',
                              bad ? 'text-rose-300' : done ? 'text-emerald-300' : active ? 'text-bnb' : 'text-slate-600',
                            )}
                          >
                            {STEP_STATUS_LABEL[step.status]}
                          </span>
                        </p>

                        {step.status === 'idle' && (
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                            {STEP_COPY[step.id].what}
                          </p>
                        )}

                        {step.failure && (
                          <div className="mt-1.5">
                            <p className="text-[11px] font-semibold text-rose-200">
                              {step.failure.title}
                              {step.failure.errorName && (
                                <span className="ml-1.5 font-mono font-normal text-rose-300/80">
                                  {step.failure.errorName}()
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-rose-100/80">
                              {step.failure.detail}
                            </p>
                          </div>
                        )}

                        {step.txHash && (
                          <p className="mt-1.5">
                            <TxLink hash={step.txHash} chainId={chainId} label="tx" />
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {phase === 'settling' && !failedStep && (
              <Notice tone="slate" icon={<Hourglass className="h-3.5 w-3.5" />}>
                Each call is checked against the chain before your wallet is asked to sign it, so a step that would
                revert is caught before it costs you gas. Keep this dialog open until the sequence finishes.
              </Notice>
            )}

            {failedStep && run.jobId !== null && failedStep.id !== 'create' && (
              <Notice tone="slate" icon={<Vault className="h-3.5 w-3.5" />}>
                Job #{run.jobId.toString()} exists on {chainMeta.name} and is recorded in this browser, so it is not
                lost. Nothing is escrowed until the fund step confirms.
              </Notice>
            )}

            {phase === 'settled' && (
              <Notice tone="gold" icon={<Coins className="h-3.5 w-3.5" />}>
                The kernel now holds the budget. It releases to {agent.name} when the job is completed and the
                evaluator policy agrees, and it is refundable to you once the deadline passes without a completion.
                Bazar reads that state back from the chain - it does not track it here.
              </Notice>
            )}
          </div>
        )}
      </div>

      {/* ---------------------------- footer ---------------------------- */}
      <div className="shrink-0 border-t border-white/[0.08] p-4 sm:p-5">
        {phase === 'brief' && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Budget</p>
              <p className="tabular truncate text-sm font-semibold text-white">
                {budget.wei !== null ? `${formatBudget(budget.wei, decimals ?? 18)} ${symbol}` : '-'}
              </p>
            </div>
            <Button type="button" onClick={() => setPhase('review')} disabled={!canReview}>
              Review the commitment
            </Button>
          </div>
        )}

        {phase === 'review' && (
          <div className="space-y-3">
            {!connected ? (
              <>
                <ConnectButton fullWidth />
                <p className="text-center text-[11px] leading-snug text-slate-500">
                  Connect the wallet that will pay for this hire. It becomes the job&apos;s client onchain - the only
                  address the kernel will let fund or refund it.
                </p>
              </>
            ) : !onTargetChain ? (
              <>
                <Button
                  type="button"
                  variant="danger"
                  className="w-full"
                  loading={isSwitching}
                  onClick={() => switchChain({ chainId })}
                  leftIcon={<TriangleAlert className="h-4 w-4" aria-hidden />}
                >
                  Switch to {chainMeta.name}
                </Button>
                <p className="text-center text-[11px] leading-snug text-slate-500">
                  Your wallet is on chain {walletChainId}. The kernel you chose is on {chainMeta.name} ({chainId}).
                </p>
              </>
            ) : provider.status !== 'resolved' ? (
              <p className="text-center text-[11px] leading-snug text-rose-300">
                {provider.status === 'loading'
                  ? 'Resolving the agent’s wallet from the Identity Registry.'
                  : provider.reason}
              </p>
            ) : (
              <>
                <Button
                  type="button"
                  className="w-full"
                  onClick={launch}
                  disabled={Boolean(blockingReason) || !fundable}
                  leftIcon={<Lock className="h-4 w-4" aria-hidden />}
                >
                  Sign and fund on {chainMeta.shortName}
                </Button>
                {!fundable && (
                  <p className="text-center text-[11px] leading-snug text-rose-300">
                    {tokenState.status === 'ready' && budget.wei !== null
                      ? `This wallet holds ${formatBudget(tokenState.position.balance, tokenState.position.decimals)} ${symbol} on ${chainMeta.name}, which does not cover the budget.`
                      : tokenState.status === 'error'
                        ? `Your ${symbol} balance on ${chainMeta.name} could not be read, so Bazar will not start a sequence it cannot tell will finish.`
                        : `Reading your ${symbol} balance on ${chainMeta.name}.`}
                  </p>
                )}
              </>
            )}

            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setPhase('brief')}>
              Back to the brief
            </Button>
          </div>
        )}

        {phase === 'settling' && (
          <div className="space-y-2.5">
            {failedStep ? (
              <>
                <Button type="button" className="w-full" onClick={launch} leftIcon={<Wallet className="h-4 w-4" aria-hidden />}>
                  {failedStep.failure?.kind === 'rejected' ? 'Ask my wallet again' : 'Retry this step'}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={onClose}>
                  Close - nothing further will be sent
                </Button>
              </>
            ) : (
              <p className="text-center text-[11px] text-slate-500">
                {activeStatus === null
                  ? 'Preparing the next step.'
                  : `${STEP_STATUS_LABEL[activeStatus]}.`}
                {activeStatus === 'awaiting-signature' && ' Your wallet is asking you to confirm.'}
              </p>
            )}
          </div>
        )}

        {phase === 'settled' && (
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button href="/dashboard" variant="secondary" className="w-full sm:flex-1">
              Open the dashboard
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
