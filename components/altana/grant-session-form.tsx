'use client';

/**
 * Granting a session key.
 *
 * The three constraints the Altana track names - a call allowlist, a spend cap
 * and an expiry - are all set here, and all three are shown before anything is
 * signed. The allowlist is not a free-text field on purpose: it is the exact
 * set of calls that funding an ERC-8183 job requires, derived from the ABIs in
 * `lib/abi/` (see `lib/altana/scope.ts`), so what the user grants and what the
 * hire path later needs cannot drift apart.
 *
 * The expiry is computed from the chain's head timestamp, not the browser's
 * clock, because `block.timestamp` is what the KeyStore and the account compare
 * against. If the head block cannot be read, the form refuses to grant rather
 * than pick an expiry that might already be in the past.
 */

import { useMemo, useState } from 'react';
import { parseEther, parseUnits } from 'viem';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins, Fingerprint, Lock, TriangleAlert } from '@/components/ui/icons';
import { formatChainTimestamp, formatSeconds } from '@/components/hire/hire-networks';
import type { SpendPeriod } from '@/lib/altana/abi';
import { type AltanaNetwork } from '@/lib/altana/config';
import type { WalletPosition } from '@/lib/altana/read';
import { buildHireScope } from '@/lib/altana/scope';
import { grantHireSession } from '@/lib/altana/sdk';
import { saveAltanaSession, type StoredWallet } from '@/lib/altana/session-store';
import { shortAddress } from '@/lib/utils';

import { formatAmount } from './format';

/* ------------------------------------------------------------------ */
/* Choices                                                             */
/* ------------------------------------------------------------------ */

interface Lifetime {
  id: string;
  label: string;
  seconds: number;
}

const LIFETIMES: readonly Lifetime[] = [
  { id: '1h', label: '1 hour', seconds: 3_600 },
  { id: '24h', label: '24 hours', seconds: 86_400 },
  { id: '7d', label: '7 days', seconds: 604_800 },
  { id: '30d', label: '30 days', seconds: 2_592_000 },
] as const;

const PERIODS: readonly SpendPeriod[] = ['hour', 'day', 'week', 'month'] as const;

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

export interface GrantSessionFormProps {
  network: AltanaNetwork;
  wallet: StoredWallet;
  chainTime: number | null;
  feeWei: bigint | null;
  position: WalletPosition | null;
  /**
   * True when the KeyStore holds no keys for this wallet yet.
   *
   * The first admin action carries TWO registrations, not one: the SDK
   * prepends `initialRegisterKey` for the wallet's own admin authority before
   * the session's `registerKey`, and both are payable at the same fee.
   * Observed directly - a grant on an unfunded wallet is refused by the relay
   * with two calls to the Controller in the request, each carrying the fee as
   * `value`.
   */
  firstGrant: boolean;
  onGranted: () => void;
}

export function GrantSessionForm({
  network,
  wallet,
  chainTime,
  feeWei,
  position,
  firstGrant,
  onGranted,
}: GrantSessionFormProps) {
  const [label, setLabel] = useState('Hiring agent');
  const [capText, setCapText] = useState('25');
  const [capPeriod, setCapPeriod] = useState<SpendPeriod>('day');
  const [gasText, setGasText] = useState('0.01');
  const [gasPeriod, setGasPeriod] = useState<SpendPeriod>('day');
  const [lifetimeId, setLifetimeId] = useState('24h');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decimals = position?.tokenDecimals ?? 18;
  const symbol = position?.tokenSymbol ?? 'U';

  const lifetime = LIFETIMES.find((l) => l.id === lifetimeId) ?? LIFETIMES[1]!;
  const expiry = chainTime === null ? null : chainTime + lifetime.seconds;

  const cap = useMemo(() => parseAmount(capText, decimals), [capText, decimals]);
  const gas = useMemo(() => parseAmount(gasText, 18), [gasText]);

  const scope = useMemo(
    () =>
      buildHireScope({
        network,
        tokenLimit: cap.value ?? 0n,
        tokenPeriod: capPeriod,
        gasLimit: gas.value ?? 0n,
        gasPeriod,
      }),
    [network, cap.value, capPeriod, gas.value, gasPeriod],
  );

  const noGas = position !== null && position.native === 0n;
  const ready =
    label.trim().length > 0 &&
    cap.value !== null &&
    cap.value > 0n &&
    gas.value !== null &&
    gas.value > 0n &&
    expiry !== null &&
    !busy;

  async function grant() {
    if (!ready || expiry === null || cap.value === null || gas.value === null) return;
    setBusy(true);
    setError(null);
    try {
      const granted = await grantHireSession({
        network,
        wallet,
        label: label.trim(),
        scope,
        expiry,
      });
      saveAltanaSession({ ...granted.session, grantedAtChainTime: chainTime });
      onGranted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ---------------- label ---------------- */}
      <section>
        <label htmlFor="altana-label" className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          What is this key for
        </label>
        <input
          id="altana-label"
          value={label}
          onChange={(event) => setLabel(event.target.value.slice(0, 60))}
          className="ring-focus mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white transition-colors placeholder:text-slate-600 hover:border-white/20"
          placeholder="Hiring agent"
        />
        <p className="mt-1 text-[10px] text-slate-600">
          A name for this browser only. The chain records the key, not the label.
        </p>
      </section>

      {/* ---------------- caps ---------------- */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="altana-cap" className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Spend cap in {symbol}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="altana-cap"
              inputMode="decimal"
              value={capText}
              onChange={(event) => setCapText(event.target.value)}
              className="ring-focus tabular min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white transition-colors hover:border-white/20"
            />
            <select
              aria-label="Spend cap period"
              value={capPeriod}
              onChange={(event) => setCapPeriod(event.target.value as SpendPeriod)}
              className="ring-focus rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-xs text-slate-200"
            >
              {PERIODS.map((period) => (
                <option key={period} value={period} className="bg-ink">
                  per {period}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
            {cap.error ?? `The most escrow this key can ever fund per ${capPeriod}. Enforced by the account.`}
          </p>
        </div>

        <div>
          <label htmlFor="altana-gas" className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Gas allowance in {network.nativeSymbol}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="altana-gas"
              inputMode="decimal"
              value={gasText}
              onChange={(event) => setGasText(event.target.value)}
              className="ring-focus tabular min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white transition-colors hover:border-white/20"
            />
            <select
              aria-label="Gas allowance period"
              value={gasPeriod}
              onChange={(event) => setGasPeriod(event.target.value as SpendPeriod)}
              className="ring-focus rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-xs text-slate-200"
            >
              {PERIODS.map((period) => (
                <option key={period} value={period} className="bg-ink">
                  per {period}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
            {gas.error ?? 'What the key may spend on relay fees. Listed first, which is how Porto picks the fee token for bundles this key signs.'}
          </p>
        </div>
      </section>

      {/* ---------------- expiry ---------------- */}
      <section>
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Expires after</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {LIFETIMES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setLifetimeId(option.id)}
              aria-pressed={option.id === lifetimeId}
              className={
                option.id === lifetimeId
                  ? 'ring-focus rounded-xl border border-bnb/50 bg-bnb/10 px-3 py-1.5 text-xs font-medium text-bnb'
                  : 'ring-focus rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-slate-300 hover:border-white/20'
              }
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">
          {expiry === null ? (
            <span className="text-amber-300">
              The head block could not be read, so an expiry cannot be computed against the chain&apos;s clock.
            </span>
          ) : (
            <>
              Registered with expiry <span className="tabular text-slate-400">{formatChainTimestamp(expiry)}</span>,
              which is head + {formatSeconds(lifetime.seconds)}. After that the account refuses the key with no
              further action from you.
            </>
          )}
        </p>
      </section>

      {/* ---------------- the allowlist being granted ---------------- */}
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
        <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          The {scope.calls.length} calls this key will be allowed
        </h3>
        <ul className="mt-2 space-y-1.5">
          {scope.calls.map((call) => (
            <li key={`${call.to}-${call.signature}`} className="text-[11px] leading-relaxed">
              <span className="block truncate font-mono text-slate-300">{call.signature}</span>
              <span className="block text-slate-500">
                on {shortAddress(call.to)} - {call.what}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[10px] leading-relaxed text-slate-500">
          Nothing else. No transfer, no settle, no dispute, no approval to any address but the kernel. A call
          outside this list is rejected by the account at validation time, before it executes.
        </p>
      </section>

      {/* ---------------- cost ---------------- */}
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
        <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <Coins className="h-3.5 w-3.5" aria-hidden />
          What granting costs
        </h3>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          {feeWei === null ? (
            'The KeyStore registration fee could not be read from the Controller right now.'
          ) : (
            <>
              <span className="tabular text-white">
                {formatAmount(feeWei * (firstGrant ? 2n : 1n), 18, 6)} {network.nativeSymbol}
              </span>{' '}
              to the KeyStore Controller, plus the relay&apos;s fee for the intent. The unit fee is{' '}
              <span className="tabular">{formatAmount(feeWei, 18, 6)}</span> {network.nativeSymbol}, read live
              from <span className="font-mono">getRegistrationFeeInWei</span>.
              {firstGrant
                ? ' It is charged twice here because this wallet has no KeyStore entry yet: the first admin action registers the wallet’s own passkey as well as this session key.'
                : ' Registering is what makes the key verifiable by anyone reading the registry, rather than only by this account.'}
            </>
          )}
        </p>
        {noGas && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-300">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            This wallet holds no {network.nativeSymbol}. The relay refuses a grant it cannot pay for - the
            registration calls carry the fee as their value - so fund the address above first.
          </p>
        )}
      </section>

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-3 text-[11px] leading-relaxed text-rose-200">
          {error}
        </p>
      )}

      <div>
        <Button
          type="button"
          className="w-full"
          onClick={grant}
          loading={busy}
          disabled={!ready}
          leftIcon={<Fingerprint className="h-4 w-4" aria-hidden />}
        >
          Grant this session key
        </Button>
        <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
          Your passkey signs the grant. The session key itself is generated in this browser and stays here -
          it is never sent to Bazar, to Altana, or to anyone else.
        </p>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-600">
        <Badge tone="slate" className="mr-1.5 align-middle">
          honest note
        </Badge>
        The session key is written to this browser&apos;s localStorage so it can act after a reload. Anything
        that can run script on this origin can read it. That is exactly why it is bounded: the cap, the
        allowlist and the expiry above are enforced by the account contract, not by the browser.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function parseAmount(text: string, decimals: number): { value: bigint | null; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { value: null, error: 'Enter an amount.' };
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '.') {
    return { value: null, error: 'Enter a plain decimal amount.' };
  }
  const fraction = trimmed.split('.')[1] ?? '';
  if (fraction.length > decimals) {
    return { value: null, error: `That is more precision than ${decimals} decimals can hold.` };
  }
  try {
    const value = decimals === 18 ? parseEther(trimmed) : parseUnits(trimmed, decimals);
    if (value <= 0n) return { value: null, error: 'The cap has to be more than zero.' };
    return { value, error: null };
  } catch {
    return { value: null, error: 'That is not an amount this token can hold.' };
  }
}
