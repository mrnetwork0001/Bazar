'use client';

/**
 * Funding a job with a session key instead of a wallet signature.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS ACTUALLY DIFFERENT
 *
 * The wallet path asks the hirer to sign four or five transactions in sequence,
 * each simulated first, each costing gas from their own address. This path
 * sends ONE atomic intent to the Altana relay, signed by a session key that was
 * authorized in advance, and the kernel's `client` is the Altana smart wallet
 * rather than the browser wallet. Nothing here asks the user to approve
 * anything: the approval happened once, on /permissions, bounded by an
 * allowlist, a spend cap and an expiry.
 *
 * That is the point of the panel. A session key that funds a real job is the
 * difference between describing delegated authority and demonstrating it.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT REFUSES TO DO
 *
 * It will not offer the button unless the chain says every precondition holds:
 *
 *   - the KeyStore reports the key registered, unrevoked and unexpired
 *   - the account allows all six hire calls and refuses the control probe
 *   - the account's remaining spend allowance covers this budget
 *   - the Altana wallet actually holds the budget, and holds gas for the fee
 *
 * Each failed check is named. A session that cannot fund this job is shown with
 * the reason it cannot, not hidden.
 */

import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CircleCheck, ExternalLink, Loader2, ShieldCheck, TriangleAlert } from '@/components/ui/icons';
import { formatAmount } from '@/components/altana/format';
import { useAltanaConsole, type PermissionRow } from '@/components/altana/use-altana-console';
import { altanaTxUrl, getAltanaNetwork } from '@/lib/altana/config';
import { altanaClient } from '@/lib/altana/read';
import { hireThroughAltanaSession } from '@/lib/altana/sdk';
import {
  readAltanaStore,
  recordAltanaRun,
  subscribeToAltanaStore,
  type StoredSession,
} from '@/lib/altana/session-store';
import { BSC_MAINNET } from '@/lib/chain/addresses';
import type { Address, IndexedAgent } from '@/lib/types';
import { cn, shortAddress } from '@/lib/utils';

import { formatSeconds } from './hire-networks';
import { recordHireReceipt } from './job-receipts';

/** Room between now and the session's expiry before the relay would refuse it. */
const EXPIRY_BUFFER_SECONDS = 120;

export interface AltanaHirePanelProps {
  agent: IndexedAgent;
  /** The agent's wallet, resolved from the Identity Registry. */
  provider: Address | null;
  /** The job description, as typed. */
  brief: string;
  /** Budget in the payment token's smallest unit, or null while unusable. */
  budgetWei: bigint | null;
  /** Extra submission time beyond the policy's dispute window. */
  deadlineSeconds: number;
}

interface Candidate {
  row: PermissionRow;
  session: StoredSession;
  /** Empty when the session can fund this job right now. */
  blockers: string[];
  /** Remaining allowance for the payment token, when the account answered. */
  remaining: bigint | null;
}

/**
 * Gate before the hook.
 *
 * `useAltanaConsole` reads the chain the moment it mounts, and the review
 * screen is on the critical path of every hire. A browser with no Altana wallet
 * has nothing for this panel to say, so it costs it nothing: the console hook
 * is not mounted at all until the local store says there is a wallet.
 */
export function AltanaHirePanel(props: AltanaHirePanelProps) {
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    const sync = () => setHasWallet(Boolean(readAltanaStore().wallet));
    sync();
    return subscribeToAltanaStore(sync);
  }, []);

  if (!hasWallet) return null;
  return <AltanaHirePanelBody {...props} />;
}

function AltanaHirePanelBody({
  agent,
  provider,
  brief,
  budgetWei,
  deadlineSeconds,
}: AltanaHirePanelProps) {
  const network = getAltanaNetwork(BSC_MAINNET);
  const { wallet, state, refresh } = useAltanaConsole(BSC_MAINNET);

  const [busyKeyId, setBusyKeyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ jobId: string; txHash: string | null; callsId: string } | null>(null);

  const decimals = state.position?.tokenDecimals ?? 18;
  const symbol = state.position?.tokenSymbol ?? 'U';

  const candidates = useMemo<Candidate[]>(() => {
    return state.rows
      .filter((row): row is PermissionRow & { local: StoredSession } => row.kind === 'session' && row.local !== null)
      .map((row) => {
        const blockers: string[] = [];
        const record = row.keystore;

        if (!record) {
          blockers.push('The KeyStore does not list this key, so no third party can verify it.');
        } else if (record.revoked) {
          blockers.push('Revoked onchain.');
        } else if (!record.valid) {
          blockers.push('The KeyStore reports this key as not valid.');
        }

        const expiry = record?.expiry ?? row.local.expiry;
        if (state.chainTime === null) {
          blockers.push('The head block could not be read, so the expiry cannot be checked.');
        } else if (expiry !== 0 && expiry - state.chainTime < EXPIRY_BUFFER_SECONDS) {
          blockers.push(
            expiry <= state.chainTime
              ? 'Expired by the chain’s own clock.'
              : 'Expires within two minutes - too little room to land a bundle.',
          );
        }

        if (row.allowlistError) {
          blockers.push('The account could not be asked what this key may call.');
        } else if (row.allowlist) {
          const missing = row.allowlist.filter((probe) => !probe.control && !probe.allowed);
          const control = row.allowlist.find((probe) => probe.control);
          if (missing.length > 0) {
            blockers.push(
              `The account refuses ${missing.length} of the calls a hire needs (${missing[0]!.label.toLowerCase()}).`,
            );
          }
          if (control?.allowed) {
            blockers.push('The account allowed the control call, so this key is not scoped as described.');
          }
        } else {
          blockers.push('This key’s allowlist could not be read.');
        }

        const tokenSpend =
          row.spend?.find((info) => info.token.toLowerCase() === network.erc8183.paymentToken.toLowerCase()) ??
          null;
        let remaining: bigint | null = null;
        if (row.spendError) {
          blockers.push('The account’s spend counters could not be read.');
        } else if (!tokenSpend) {
          blockers.push(`This key has no ${symbol} spending cap, so it cannot be shown to cover this budget.`);
        } else {
          remaining = tokenSpend.remaining;
          if (budgetWei !== null && tokenSpend.remaining < budgetWei) {
            blockers.push(
              `Its remaining allowance is ${formatAmount(tokenSpend.remaining, decimals)} ${symbol}, under this budget.`,
            );
          }
        }

        return { row, session: row.local, blockers, remaining };
      });
  }, [budgetWei, decimals, network.erc8183.paymentToken, state.chainTime, state.rows, symbol]);

  /* -------- wallet-level blockers, shared by every candidate -------- */
  const walletBlockers: string[] = [];
  if (state.positionError) {
    walletBlockers.push('The Altana wallet’s balances could not be read.');
  } else if (state.position) {
    if (budgetWei !== null && state.position.token < budgetWei) {
      walletBlockers.push(
        `The Altana wallet holds ${formatAmount(state.position.token, decimals)} ${symbol}, which does not cover this budget. It is the wallet that pays, not your connected one.`,
      );
    }
    if (state.position.native === 0n) {
      walletBlockers.push(`The Altana wallet holds no ${network.nativeSymbol} for the relay fee.`);
    }
  }

  async function fund(candidate: Candidate) {
    if (!provider || budgetWei === null) return;
    setBusyKeyId(candidate.session.keyId);
    setError(null);
    try {
      const result = await hireThroughAltanaSession({
        network,
        session: candidate.session,
        provider,
        task: brief.trim(),
        budget: budgetWei,
        deadlineSeconds,
      });

      const run = {
        jobId: result.jobId.toString(),
        callsId: result.callsId,
        txHash: result.transactionHash,
        budgetWei: budgetWei.toString(),
        provider,
        agentSlug: agent.slug,
        agentName: agent.name,
      };
      recordAltanaRun(candidate.session.keyId, run);

      // The receipt store's contract is that `createTxHash` is a transaction.
      // When the relay confirms a bundle without reporting one, no receipt is
      // written rather than a relay bundle id being passed off as a tx hash.
      if (result.transactionHash) {
        try {
          const receipt = await altanaClient(network).getTransactionReceipt({
            hash: result.transactionHash as `0x${string}`,
          });
          recordHireReceipt({
            chainId: BSC_MAINNET,
            jobId: run.jobId,
            client: result.client.toLowerCase(),
            provider: provider.toLowerCase(),
            agentSlug: agent.slug,
            agentName: agent.name,
            budgetWei: run.budgetWei,
            createTxHash: result.transactionHash,
            registerTxHash: result.transactionHash,
            budgetTxHash: result.transactionHash,
            approveTxHash: result.transactionHash,
            fundTxHash: result.transactionHash,
            createdAtBlock: receipt.blockNumber.toString(),
          });
        } catch {
          // The job is funded either way; the local note is a convenience.
        }
      }

      setDone({ jobId: run.jobId, txHash: result.transactionHash, callsId: result.callsId });
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyKeyId(null);
    }
  }

  /* ---------------------------- render ---------------------------- */

  if (done) {
    return (
      <section className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.05] p-3">
        <h3 className="flex items-center gap-2 text-xs font-medium text-emerald-200">
          <CircleCheck className="h-4 w-4" aria-hidden />
          Funded by a session key
        </h3>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
          Job <span className="tabular font-mono text-white">#{done.jobId}</span> is funded on{' '}
          {network.name}. The kernel&apos;s client is the Altana wallet, and the whole five-call sequence
          landed as one intent signed by the session key - no wallet prompt at any point.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
          {done.txHash ? (
            <a
              href={altanaTxUrl(network, done.txHash)}
              target="_blank"
              rel="noreferrer"
              className="ring-focus inline-flex items-center gap-1 rounded font-mono text-bnb hover:underline"
            >
              {done.txHash.slice(0, 12)}…{done.txHash.slice(-6)}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : (
            <span className="text-slate-500">
              The relay confirmed bundle <span className="font-mono">{done.callsId.slice(0, 12)}…</span> without
              reporting a transaction hash.
            </span>
          )}
          <a href="/permissions" className="ring-focus rounded text-slate-400 hover:text-white">
            See it on the key
          </a>
        </div>
      </section>
    );
  }

  if (!wallet) return null;

  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Or fund it with a session key
        </h3>
        <Badge tone="slate">no wallet prompt</Badge>
      </div>

      {state.status === 'loading' ? (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Checking what your session keys are allowed to do.
        </p>
      ) : state.keystoreError ? (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-300">
          The KeyStore could not be read, so no session key can be shown as usable. {state.keystoreError.message}
        </p>
      ) : candidates.length === 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          This browser holds no session key for your Altana wallet on {network.name}.{' '}
          <a href="/permissions" className="ring-focus rounded text-bnb hover:underline">
            Grant one on the permissions page
          </a>{' '}
          and this job can be funded without a wallet signature.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {candidates.map((candidate) => {
            const blockers = [...candidate.blockers, ...walletBlockers];
            const usable = blockers.length === 0 && provider !== null && budgetWei !== null;
            return (
              <li
                key={candidate.session.keyId}
                className={cn(
                  'rounded-xl border p-2.5',
                  usable ? 'border-bnb/30 bg-bnb/[0.04]' : 'border-white/[0.06] bg-white/[0.02]',
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-white">{candidate.session.label}</span>
                  {candidate.remaining !== null && (
                    <span className="tabular text-[11px] text-slate-400">
                      {formatAmount(candidate.remaining, decimals)} {symbol} left in its cap
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                  Signs as {shortAddress(candidate.session.walletAddress)} - that address becomes the job&apos;s
                  client and pays the escrow. The deadline is the policy&apos;s dispute window plus{' '}
                  {formatSeconds(deadlineSeconds)}.
                </p>

                {blockers.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {blockers.map((reason) => (
                      <li key={reason} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-300">
                        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                        {reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2 w-full"
                    loading={busyKeyId === candidate.session.keyId}
                    disabled={busyKeyId !== null}
                    onClick={() => fund(candidate)}
                    leftIcon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Fund through this session key
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/[0.07] p-2.5 text-[11px] leading-relaxed text-rose-200">
          {error}
        </p>
      )}
    </section>
  );
}
