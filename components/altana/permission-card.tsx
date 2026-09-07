'use client';

/**
 * One authorization, as the chain describes it.
 *
 * Everything on this card is a read: the registry record, the account's live
 * spend counters, and the account's own answer to "may this key make this
 * call". The only fields that come from the browser are the label the user
 * typed and the list of hires run through the key, and both are marked as such.
 *
 * The allowlist block always includes a control probe - a call the grant
 * deliberately excludes. A list of green ticks proves nothing on its own; a
 * green list next to a red control proves the account is discriminating.
 */

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/agents/copy-button';
import {
  Check,
  Coins,
  ExternalLink,
  Fingerprint,
  Lock,
  ShieldCheck,
  ShieldOff,
  TriangleAlert,
  X,
} from '@/components/ui/icons';
import { altanaAddressUrl, altanaTxUrl, type AltanaNetwork } from '@/lib/altana/config';
import { cn, shortAddress } from '@/lib/utils';
import { formatChainTimestamp } from '@/components/hire/hire-networks';

import { expiryState, formatAmount, periodPhrase, shortHex } from './format';
import type { PermissionRow } from './use-altana-console';

interface PermissionCardProps {
  row: PermissionRow;
  network: AltanaNetwork;
  chainTime: number | null;
  tokenDecimals: number;
  tokenSymbol: string;
  /** Null while no admin passkey is on file - the revoke control needs one. */
  canRevoke: boolean;
  revoking: boolean;
  onRevoke: (row: PermissionRow) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.05] py-2 last:border-b-0">
      <span className="shrink-0 text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="min-w-0 text-right text-xs text-slate-300">{children}</span>
    </div>
  );
}

export function PermissionCard({
  row,
  network,
  chainTime,
  tokenDecimals,
  tokenSymbol,
  canRevoke,
  revoking,
  onRevoke,
}: PermissionCardProps) {
  const [confirming, setConfirming] = useState(false);

  const record = row.keystore;
  const expiry = record?.expiry ?? row.local?.expiry ?? 0;
  const expiryInfo = expiryState(expiry, chainTime);
  const revoked = record?.revoked ?? false;
  const valid = record?.valid ?? null;

  const isRoot = row.kind === 'root';
  const controlProbe = row.allowlist?.find((probe) => probe.control) ?? null;
  const allowlistLooksSound = controlProbe ? !controlProbe.allowed : null;

  const statusTone = revoked
    ? 'rose'
    : valid === false
      ? 'slate'
      : expiryInfo.tone === 'expired'
        ? 'slate'
        : expiryInfo.tone === 'soon'
          ? 'gold'
          : 'emerald';

  const statusLabel = revoked
    ? 'Revoked onchain'
    : valid === false
      ? 'Not valid'
      : valid === true
        ? 'Valid onchain'
        : 'Registry unread';

  return (
    <li
      className={cn(
        'rounded-2xl border p-4',
        revoked
          ? 'border-white/[0.06] bg-white/[0.01] opacity-75'
          : isRoot
            ? 'border-white/[0.08] bg-white/[0.02]'
            : 'border-bnb/25 bg-bnb/[0.03]',
      )}
    >
      {/* -------------------------- header -------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isRoot ? (
              <Fingerprint className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0 text-bnb" aria-hidden />
            )}
            <h3 className="truncate text-sm font-medium text-white">
              {isRoot ? 'Root authority (passkey)' : (row.local?.label ?? 'Session key')}
            </h3>
            <Badge tone={statusTone}>{statusLabel}</Badge>
            {!isRoot && (
              <Badge tone={expiryInfo.tone === 'expired' ? 'slate' : 'sky'}>{expiryInfo.short}</Badge>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {isRoot
              ? 'The wallet’s own admin key. It has no allowlist and no cap by design - it is the authority that grants and revokes the keys below.'
              : row.local
                ? 'Granted from this browser. The key material is held here; the constraints are held by the account contract.'
                : 'Registered onchain, with no key material in this browser. It was granted somewhere else - it can still be revoked from here.'}
          </p>
        </div>

        {!isRoot && !revoked && (
          <div className="shrink-0">
            {confirming ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  loading={revoking}
                  disabled={!canRevoke}
                  onClick={() => onRevoke(row)}
                  leftIcon={<ShieldOff className="h-3.5 w-3.5" aria-hidden />}
                >
                  Revoke for good
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={revoking}>
                  Keep
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={!canRevoke}
                onClick={() => setConfirming(true)}
                leftIcon={<ShieldOff className="h-3.5 w-3.5" aria-hidden />}
              >
                Revoke
              </Button>
            )}
          </div>
        )}
      </div>

      {confirming && !revoking && (
        <p className="mt-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-2.5 text-[11px] leading-relaxed text-rose-200">
          Revocation is monotonic in KeyStore v1.0.0 - a revoked key cannot be brought back, only replaced.
          One intent does both halves: the account drops the key&apos;s authority and the registry marks the
          entry revoked, so every other reader sees it too. Your passkey signs it.
        </p>
      )}

      {/* -------------------------- identity -------------------------- */}
      <dl className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3">
        <Field label="KeyStore id">
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono">{shortHex(row.keyId)}</span>
            <CopyButton value={row.keyId} label="KeyStore key id" />
          </span>
        </Field>
        {row.accountKeyHash && (
          <Field label="Account key hash">
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono">{shortHex(row.accountKeyHash)}</span>
              <CopyButton value={row.accountKeyHash} label="account key hash" />
            </span>
          </Field>
        )}
        <Field label="Expiry">
          <span className="tabular">
            {expiry === 0 ? 'none' : formatChainTimestamp(expiry)}
            <span className="ml-1.5 text-slate-500">{expiryInfo.short}</span>
          </span>
        </Field>
        {record && (
          <Field label="Registry">
            <span>
              {record.isRoot ? 'root key' : 'session key'}, validator{' '}
              <span className="font-mono">{shortAddress(record.validator)}</span>
            </span>
          </Field>
        )}
        {row.accountKey && (
          <Field label="Account">
            <span>
              holds this key{row.accountKey.isSuperAdmin ? ', super admin' : ', not super admin'}
            </span>
          </Field>
        )}
        {!row.accountKey && !isRoot && (
          <Field label="Account">
            <span className="text-slate-500">
              not listed by the account contract at this block
            </span>
          </Field>
        )}
        {row.local?.grantTxHash && (
          <Field label="Granted by">
            <a
              href={altanaTxUrl(network, row.local.grantTxHash)}
              target="_blank"
              rel="noreferrer"
              className="ring-focus inline-flex items-center gap-1 rounded font-mono text-bnb hover:underline"
            >
              {shortHex(row.local.grantTxHash)}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </Field>
        )}
        {row.local?.revokeTxHash && (
          <Field label="Revoked by">
            <a
              href={altanaTxUrl(network, row.local.revokeTxHash)}
              target="_blank"
              rel="noreferrer"
              className="ring-focus inline-flex items-center gap-1 rounded font-mono text-rose-300 hover:underline"
            >
              {shortHex(row.local.revokeTxHash)}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </Field>
        )}
        {!record && (
          <Field label="Registry">
            <span className="text-amber-300">not listed by getKeys at this block</span>
          </Field>
        )}
      </dl>

      {isRoot ? null : (
        <>
          {/* -------------------------- spend caps -------------------------- */}
          <section className="mt-3">
            <h4 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              <Coins className="h-3.5 w-3.5" aria-hidden />
              Spending caps, read from the account
            </h4>
            {row.spendError ? (
              <p className="mt-2 text-[11px] leading-relaxed text-amber-300">
                {row.spendError.message} The caps below are unknown - not absent.
              </p>
            ) : row.spend && row.spend.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {row.spend.map((info, index) => {
                  const native = info.token === '0x0000000000000000000000000000000000000000';
                  const decimals = native ? 18 : tokenDecimals;
                  const symbol = native ? network.nativeSymbol : tokenSymbol;
                  const used = info.limit > 0n ? Number((info.currentSpent * 1000n) / info.limit) / 10 : 0;
                  return (
                    <li
                      key={`${info.token}-${index}`}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-white">
                          {formatAmount(info.limit, decimals)} {symbol}{' '}
                          <span className="font-normal text-slate-500">{periodPhrase(info.period)}</span>
                        </span>
                        <span className="tabular text-[11px] text-slate-400">
                          {formatAmount(info.remaining, decimals)} {symbol} left this period
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-bnb"
                          style={{ width: `${Math.min(100, Math.max(0, used))}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                        {native
                          ? 'Relay fees and the KeyStore registration fee come out of this allowance.'
                          : `The escrow this key can fund. ${formatAmount(info.currentSpent, decimals)} ${symbol} spent so far this period, counted by the account.`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-amber-300">
                The account reports no spending cap on this key. A key with no cap is bounded only by its
                allowlist and its expiry.
              </p>
            )}
          </section>

          {/* -------------------------- allowlist -------------------------- */}
          <section className="mt-3">
            <h4 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Call allowlist, answered by canExecute
            </h4>
            {row.allowlistError ? (
              <p className="mt-2 text-[11px] leading-relaxed text-amber-300">
                {row.allowlistError.message} What this key may call is unknown from here.
              </p>
            ) : row.allowlist ? (
              <>
                <ul className="mt-2 space-y-1">
                  {row.allowlist.map((probe) => (
                    <li
                      key={`${probe.to}-${probe.signature}`}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border px-2.5 py-1.5',
                        probe.allowed
                          ? probe.control
                            ? 'border-rose-500/30 bg-rose-500/[0.06]'
                            : 'border-emerald-400/20 bg-emerald-400/[0.04]'
                          : probe.control
                            ? 'border-emerald-400/20 bg-emerald-400/[0.04]'
                            : 'border-white/[0.06] bg-white/[0.02]',
                      )}
                    >
                      <span aria-hidden className="mt-0.5 shrink-0">
                        {probe.allowed ? (
                          <Check
                            className={cn('h-3.5 w-3.5', probe.control ? 'text-rose-300' : 'text-emerald-300')}
                          />
                        ) : (
                          <X className={cn('h-3.5 w-3.5', probe.control ? 'text-emerald-300' : 'text-slate-500')} />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] text-slate-200">
                          {probe.label}
                          {probe.control && (
                            <span className="ml-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                              control - must be refused
                            </span>
                          )}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-slate-500">
                          {probe.signature} on {shortAddress(probe.to)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                {allowlistLooksSound === false && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-rose-300">
                    <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                    The account allowed the control call. This key is not scoped the way this page describes -
                    treat it as unrestricted and revoke it.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                The account key hash for this key could not be derived, so its allowlist could not be probed.
              </p>
            )}
          </section>

          {/* -------------------------- runs -------------------------- */}
          {row.local && row.local.runs.length > 0 && (
            <section className="mt-3">
              <h4 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Executed through this key
              </h4>
              <ul className="mt-2 space-y-1.5">
                {row.local.runs.map((run) => (
                  <li
                    key={run.jobId}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-[11px]"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-slate-200">
                        Job <span className="tabular font-mono text-white">#{run.jobId}</span> for {run.agentName}
                      </span>
                      <span className="tabular text-slate-400">
                        {formatAmount(BigInt(run.budgetWei), tokenDecimals)} {tokenSymbol}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      {run.txHash ? (
                        <a
                          href={altanaTxUrl(network, run.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="ring-focus inline-flex items-center gap-1 rounded font-mono text-bnb hover:underline"
                        >
                          {shortHex(run.txHash)}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : (
                        <span className="font-mono">relay bundle {shortHex(run.callsId)}</span>
                      )}
                      <a
                        href={altanaAddressUrl(network, run.provider)}
                        target="_blank"
                        rel="noreferrer"
                        className="ring-focus inline-flex items-center gap-1 rounded font-mono hover:underline"
                      >
                        pays {shortAddress(run.provider)}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </li>
  );
}
