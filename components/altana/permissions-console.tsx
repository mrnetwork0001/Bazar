'use client';

/**
 * The permissions console: one Altana wallet, and every key that can act on it.
 *
 * The page has three jobs, in this order of importance:
 *
 *   1. Show what is authorized right now, read from the chain. If the KeyStore
 *      cannot be read, say the KeyStore cannot be read - never render an empty
 *      list, which is a claim that the user has authorized nothing.
 *   2. Let a key be revoked, including one this browser has no secret for.
 *   3. Let a new key be granted with a call allowlist, a spend cap and an
 *      expiry the user picks.
 */

import { useCallback, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { CopyButton } from '@/components/agents/copy-button';
import {
  ExternalLink,
  Fingerprint,
  Inbox,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  Wallet,
  WifiOff,
} from '@/components/ui/icons';
import {
  ALTANA_NETWORK_LIST,
  DEFAULT_ALTANA_CHAIN_ID,
  altanaAddressUrl,
  type AltanaChainId,
} from '@/lib/altana/config';
import { createAltanaPasskeyWallet, recoverAltanaWallet, revokeAltanaSession } from '@/lib/altana/sdk';
import {
  forgetAltanaWallet,
  patchAltanaSession,
  saveAltanaWallet,
} from '@/lib/altana/session-store';
import { cn, shortAddress } from '@/lib/utils';

import { formatAmount } from './format';
import { GrantSessionForm } from './grant-session-form';
import { PermissionCard } from './permission-card';
import { useAltanaConsole, type PermissionRow } from './use-altana-console';

const WALLET_NAME = 'Bazar Altana wallet';

export function PermissionsConsole() {
  const [chainId, setChainId] = useState<AltanaChainId>(DEFAULT_ALTANA_CHAIN_ID);
  const { network, wallet, hydrated, storageOk, state, refresh } = useAltanaConsole(chainId);

  const [walletBusy, setWalletBusy] = useState<'create' | 'recover' | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);

  /* ---------------------------- wallet ---------------------------- */

  const create = useCallback(async () => {
    setWalletBusy('create');
    setWalletError(null);
    try {
      const created = await createAltanaPasskeyWallet({
        name: WALLET_NAME,
        networks: ALTANA_NETWORK_LIST,
      });
      saveAltanaWallet({
        address: created.address,
        admin: 'passkey',
        name: WALLET_NAME,
        credential: created.credential,
        chainIds: ALTANA_NETWORK_LIST.map((n) => n.chainId),
      });
      refresh();
    } catch (cause) {
      setWalletError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setWalletBusy(null);
    }
  }, [refresh]);

  const recover = useCallback(async () => {
    setWalletBusy('recover');
    setWalletError(null);
    try {
      const recovered = await recoverAltanaWallet(network);
      saveAltanaWallet({
        address: recovered.address,
        admin: 'passkey',
        name: WALLET_NAME,
        credential: recovered.credential,
        chainIds: [network.chainId],
      });
      refresh();
    } catch (cause) {
      setWalletError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setWalletBusy(null);
    }
  }, [network, refresh]);

  /* ---------------------------- revoke ---------------------------- */

  const revoke = useCallback(
    async (row: PermissionRow) => {
      if (!wallet) return;
      const publicKey = row.keystore?.publicKey ?? row.local?.publicKey ?? null;
      if (!publicKey) {
        setRevokeError('This key has no public key on file, so there is nothing to address a revoke to.');
        return;
      }
      setRevokingKeyId(row.keyId);
      setRevokeError(null);
      try {
        const result = await revokeAltanaSession({ network, wallet, sessionPublicKey: publicKey });
        if (row.local) {
          patchAltanaSession(row.local.keyId, { revokeTxHash: result.transactionHash ?? null });
        }
        if (result.status === 'FAILED') {
          setRevokeError(
            `The relay reported the revoke bundle as FAILED (${result.callsId}). The key may still be live - re-read below.`,
          );
        }
        refresh();
      } catch (cause) {
        setRevokeError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setRevokingKeyId(null);
      }
    },
    [network, refresh, wallet],
  );

  /* ---------------------------- render ---------------------------- */

  const sessions = state.rows.filter((row) => row.kind === 'session');
  const roots = state.rows.filter((row) => row.kind === 'root');
  const tokenDecimals = state.position?.tokenDecimals ?? 18;
  const tokenSymbol = state.position?.tokenSymbol ?? 'U';

  return (
    <div className="space-y-6">
      {/* -------------------- network -------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Network</span>
        {ALTANA_NETWORK_LIST.map((option) => (
          <button
            key={option.chainId}
            type="button"
            onClick={() => setChainId(option.chainId)}
            aria-pressed={option.chainId === chainId}
            className={cn(
              'ring-focus rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
              option.chainId === chainId
                ? 'border-bnb/50 bg-bnb/10 text-bnb'
                : 'border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/20',
            )}
          >
            {option.name}
            <span className="ml-1.5 font-mono text-[10px] text-slate-500">{option.chainId}</span>
          </button>
        ))}
        <Badge tone={network.liveFunds ? 'gold' : 'slate'}>
          {network.liveFunds ? 'Real funds' : 'Test funds'}
        </Badge>
      </div>

      {!storageOk && hydrated && (
        <GlassCard className="border-amber-400/25">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-200">
            <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
            This browser refuses local storage, so a session key granted here could not be kept and would be
            stranded the moment the page reloads. Granting is disabled until storage works - private windows
            and blocked site data are the usual causes.
          </p>
        </GlassCard>
      )}

      {/* -------------------- wallet -------------------- */}
      <GlassCard>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-medium text-white">
              <Wallet className="h-4 w-4 text-bnb" aria-hidden />
              The agent&apos;s Altana wallet
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              A self-custodial smart account whose admin authority is a passkey held by your operating system.
              Bazar keeps the public half of that credential so it can ask your device to sign; the private
              half never leaves the secure element, and Bazar never holds a key of yours.
            </p>
          </div>
        </div>

        {!hydrated ? (
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Reading this browser&apos;s records.
          </p>
        ) : !wallet ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onClick={create}
                loading={walletBusy === 'create'}
                disabled={walletBusy !== null || !storageOk}
                leftIcon={<Fingerprint className="h-4 w-4" aria-hidden />}
              >
                Create a wallet with a passkey
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={recover}
                loading={walletBusy === 'recover'}
                disabled={walletBusy !== null || !storageOk}
              >
                Find one from an existing passkey
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Creating costs nothing and mines nothing: the EIP-7702 delegation is prepared with the relay and
              lands with the wallet&apos;s first real action. Recovery reads the admin key back out of the
              KeyStore, so it only works for a wallet that has already acted onchain.
            </p>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Your MetaMask or Trust Wallet cannot be the admin authority here. The Altana SDK does not accept
              injected wallets as signers - they refuse the two signatures the EIP-7702 flow needs - so the
              wallet is a separate account that you fund from your usual one.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={altanaAddressUrl(network, wallet.address)}
                target="_blank"
                rel="noreferrer"
                className="ring-focus inline-flex items-center gap-1.5 rounded font-mono text-sm text-white hover:text-bnb"
              >
                {wallet.address}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
              <CopyButton value={wallet.address} label="Altana wallet address" />
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Stat
                label={`${network.nativeSymbol} for fees`}
                value={
                  state.position
                    ? `${formatAmount(state.position.native, 18, 6)} ${network.nativeSymbol}`
                    : null
                }
              />
              <Stat
                label="Escrow balance"
                value={
                  state.position
                    ? `${formatAmount(state.position.token, state.position.tokenDecimals)} ${state.position.tokenSymbol}`
                    : null
                }
              />
              <Stat
                label="Onchain state"
                value={
                  state.position ? (state.position.delegated ? 'Delegated' : 'Counterfactual') : null
                }
              />
            </div>

            {state.positionError && (
              <p className="text-[11px] leading-relaxed text-amber-300">
                {state.positionError.message} The balances above are unknown, not zero.
              </p>
            )}

            <p className="text-[11px] leading-relaxed text-slate-500">
              Fund this address from your usual wallet: {network.nativeSymbol} pays the KeyStore registration
              fee and relay fees, and {tokenSymbol} is what a session key escrows when it hires.
              {network.faucetUrl && (
                <>
                  {' '}
                  Test {network.nativeSymbol} comes from{' '}
                  <a
                    href={network.faucetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ring-focus rounded text-bnb hover:underline"
                  >
                    the BNB Chain faucet
                  </a>
                  .
                </>
              )}
            </p>

            <ForgetWallet onForget={() => {
              forgetAltanaWallet();
              refresh();
            }} />
          </div>
        )}

        {walletError && (
          <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-3 text-[11px] leading-relaxed text-rose-200">
            {walletError}
          </p>
        )}
      </GlassCard>

      {/* -------------------- grant -------------------- */}
      {wallet && (
        <GlassCard>
          <button
            type="button"
            onClick={() => setGranting((open) => !open)}
            aria-expanded={granting}
            className="ring-focus flex w-full items-center justify-between gap-3 rounded-lg text-left"
          >
            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-white">
                <ShieldCheck className="h-4 w-4 text-bnb" aria-hidden />
                Grant a session key
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                A call allowlist, a spend cap and an expiry, registered in the KeyStore so anyone can verify
                it.
              </span>
            </span>
            <span className="shrink-0 text-xs text-slate-400">{granting ? 'Close' : 'Open'}</span>
          </button>

          {granting && (
            <div className="mt-4 border-t border-white/[0.08] pt-4">
              {storageOk ? (
                <GrantSessionForm
                  network={network}
                  wallet={wallet}
                  chainTime={state.chainTime}
                  feeWei={state.feeWei}
                  position={state.position}
                  firstGrant={!state.keystoreError && state.rows.length === 0}
                  onGranted={() => {
                    setGranting(false);
                    refresh();
                  }}
                />
              ) : (
                <p className="text-xs leading-relaxed text-amber-300">
                  Granting needs somewhere to keep the session key. This browser is refusing local storage.
                </p>
              )}
            </div>
          )}
        </GlassCard>
      )}

      {/* -------------------- the list -------------------- */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-white">What is authorized on this wallet</h2>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? 'Reading the chain' : 'Re-read the chain'}
          </Button>
        </div>

        {revokeError && (
          <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-3 text-[11px] leading-relaxed text-rose-200">
            {revokeError}
          </p>
        )}

        {!wallet ? (
          <EmptyNote
            icon={<Wallet className="h-5 w-5" aria-hidden />}
            title="No Altana wallet in this browser"
            body="Create one above, or find an existing one from its passkey. Sessions are granted on a wallet, so there is nothing to list until there is one."
          />
        ) : state.keystoreError ? (
          <GlassCard className="mt-3 border-amber-400/25">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-200">
              <WifiOff className="mt-px h-4 w-4 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">The KeyStore could not be read.</span> {state.keystoreError.message}{' '}
                This does not mean the wallet has no session keys - it means the registry at{' '}
                <span className="font-mono">{shortAddress(network.keyStore)}</span> did not answer. Re-read, or
                try again with a different RPC endpoint.
              </span>
            </p>
          </GlassCard>
        ) : state.status === 'loading' ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Reading the KeyStore and the account contract.
          </p>
        ) : state.rows.length === 0 ? (
          <EmptyNote
            icon={<Inbox className="h-5 w-5" aria-hidden />}
            title="The KeyStore holds no keys for this wallet"
            body={`getKeys on ${shortAddress(network.keyStore)} answered with an empty list. That is the registry's own answer, not a guess: nothing is authorized on this wallet yet. Granting a session key is what puts the first entry there.`}
          />
        ) : (
          <>
            {sessions.length === 0 && (
              <EmptyNote
                icon={<Inbox className="h-5 w-5" aria-hidden />}
                title="No session keys, only the wallet's own authority"
                body="The registry lists this wallet's root passkey and nothing else. A session key is what lets an agent act without your fingerprint on every transaction."
              />
            )}
            <ul className="mt-3 space-y-3">
              {[...sessions, ...roots].map((row) => (
                <PermissionCard
                  key={row.keyId}
                  row={row}
                  network={network}
                  chainTime={state.chainTime}
                  tokenDecimals={tokenDecimals}
                  tokenSymbol={tokenSymbol}
                  canRevoke={Boolean(wallet)}
                  revoking={revokingKeyId === row.keyId}
                  onRevoke={revoke}
                />
              ))}
            </ul>
          </>
        )}

        {state.accountError && wallet && !state.keystoreError && (
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            The account contract at {shortAddress(wallet.address)} did not answer <span className="font-mono">getKeys</span>:{' '}
            {state.accountError.message} A wallet that has never executed anything has no code yet, and that is
            the usual reason.
          </p>
        )}

        {state.chainTimeError && (
          <p className="mt-3 text-[11px] leading-relaxed text-amber-300">
            {state.chainTimeError.message} Every expiry above is shown as an absolute timestamp only, because
            there is no head block to compare it against.
          </p>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="tabular mt-0.5 truncate text-sm font-medium text-white">{value ?? 'unread'}</p>
    </div>
  );
}

function EmptyNote({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <GlassCard className="mt-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-slate-500">{icon}</span>
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
        </div>
      </div>
    </GlassCard>
  );
}

function ForgetWallet({ onForget }: { onForget: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="ring-focus rounded text-[11px] text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
      >
        Forget this wallet in this browser
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-3">
      <p className="text-[11px] leading-relaxed text-rose-200">
        This removes the passkey handle and every session key this browser holds. It revokes nothing: the
        authorizations stay live onchain until they are revoked or they expire. Revoke first if that is what
        you meant.
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="danger" onClick={onForget}>
          Forget it anyway
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
