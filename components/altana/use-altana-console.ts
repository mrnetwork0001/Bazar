'use client';

/**
 * The one place the permissions page gets its facts.
 *
 * Two sources, merged, and the merge is careful about which one is allowed to
 * make a claim:
 *
 *   the chain          who is authorized, what they may call, what they may
 *                      spend, when it lapses, whether it was revoked
 *   this browser       a human label, the session key's secret, and a note of
 *                      the hires that were run through it
 *
 * A row is built for every key the KeyStore returns - including keys granted on
 * another device, which is exactly the case where a revoke control earns its
 * keep. A locally-stored session that the KeyStore does not list gets a row too,
 * flagged as unregistered rather than quietly dropped.
 *
 * When a read fails, the failure is kept and rendered. Nothing here ever
 * converts "the RPC did not answer" into "you have no sessions".
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Hex } from 'viem';

import type { ChainReadError } from '@/lib/chain/client';
import { getAltanaNetwork, type AltanaChainId } from '@/lib/altana/config';
import {
  accountKeyHashFromPublicKey,
  keyCurveOf,
  probeAllowlist,
  readAccountKeys,
  readAltanaChainTime,
  readKeystoreKeyIds,
  readKeystoreRecords,
  readRegistrationFeeWei,
  readSpendInfos,
  readWalletPosition,
  type AccountKey,
  type AllowlistAnswer,
  type KeystoreRecord,
  type SpendInfo,
  type WalletPosition,
} from '@/lib/altana/read';
import { hireAllowlistProbes } from '@/lib/altana/scope';
import {
  altanaStorageAvailable,
  readAltanaStore,
  subscribeToAltanaStore,
  type AltanaStore,
  type StoredSession,
} from '@/lib/altana/session-store';

/* ------------------------------------------------------------------ */
/* Shape                                                               */
/* ------------------------------------------------------------------ */

export interface PermissionRow {
  /** KeyStore id - `keccak256(publicKey)`. Stable across both sources. */
  keyId: Hex;
  /** The registry record, or null when this key is only known locally. */
  keystore: KeystoreRecord | null;
  /** This browser's note, or null for a key granted somewhere else. */
  local: StoredSession | null;
  /** The account's own view of the key, when the account could be read. */
  accountKey: AccountKey | null;
  accountKeyHash: Hex | null;
  /** Live caps from the account. Null when they could not be read. */
  spend: SpendInfo[] | null;
  spendError: ChainReadError | null;
  /** What the account says this key may call. Null when it could not be read. */
  allowlist: AllowlistAnswer[] | null;
  allowlistError: ChainReadError | null;
  /** Root authority (the wallet's passkey) vs a delegated session key. */
  kind: 'root' | 'session';
}

export interface AltanaConsoleState {
  status: 'hydrating' | 'loading' | 'ready';
  /** Head-block timestamp. Every expiry judgement uses this, not the browser. */
  chainTime: number | null;
  chainTimeError: ChainReadError | null;
  /** Live registration fee from the Controller, in native wei. */
  feeWei: bigint | null;
  position: WalletPosition | null;
  positionError: ChainReadError | null;
  /** Set when `getKeys` itself failed - the page must then say so, loudly. */
  keystoreError: ChainReadError | null;
  /** Set when the account contract could not be read (often: never delegated). */
  accountError: ChainReadError | null;
  rows: PermissionRow[];
}

const INITIAL: AltanaConsoleState = {
  status: 'hydrating',
  chainTime: null,
  chainTimeError: null,
  feeWei: null,
  position: null,
  positionError: null,
  keystoreError: null,
  accountError: null,
  rows: [],
};

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useAltanaConsole(chainId: AltanaChainId) {
  const network = useMemo(() => getAltanaNetwork(chainId), [chainId]);

  /* -------- local store, hydrated after mount -------- */
  const [store, setStore] = useState<AltanaStore>({ wallet: null, sessions: [] });
  const [hydrated, setHydrated] = useState(false);
  const [storageOk, setStorageOk] = useState(true);

  useEffect(() => {
    setStore(readAltanaStore());
    setStorageOk(altanaStorageAvailable());
    setHydrated(true);
    return subscribeToAltanaStore(() => setStore(readAltanaStore()));
  }, []);

  /* -------- chain -------- */
  const [state, setState] = useState<AltanaConsoleState>(INITIAL);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const wallet = store.wallet?.address ?? null;

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setState((previous) => ({ ...previous, status: 'loading' }));

    (async () => {
      const [chainTime, fee] = await Promise.all([
        readAltanaChainTime(network),
        readRegistrationFeeWei(network),
      ]);

      const base: AltanaConsoleState = {
        ...INITIAL,
        status: 'ready',
        chainTime: chainTime.ok ? chainTime.value : null,
        chainTimeError: chainTime.ok ? null : chainTime,
        feeWei: fee.ok ? fee.value : null,
      };

      if (!wallet) {
        if (!cancelled) setState(base);
        return;
      }

      const [position, keyIds, accountKeys] = await Promise.all([
        readWalletPosition(network, wallet),
        readKeystoreKeyIds(network, wallet),
        readAccountKeys(network, wallet),
      ]);

      const localSessions = store.sessions.filter(
        (s) => s.chainId === chainId && s.walletAddress.toLowerCase() === wallet.toLowerCase(),
      );

      let records: KeystoreRecord[] = [];
      let keystoreError: ChainReadError | null = null;
      if (keyIds.ok) {
        const read = await readKeystoreRecords(network, wallet, keyIds.value);
        if (read.ok) records = read.value;
        else keystoreError = read;
      } else {
        keystoreError = keyIds;
      }

      const accountByHash = new Map<string, AccountKey>();
      if (accountKeys.ok) {
        for (const key of accountKeys.value) accountByHash.set(key.keyHash.toLowerCase(), key);
      }

      const probes = hireAllowlistProbes(network);
      const byKeyId = new Map<string, StoredSession>();
      for (const session of localSessions) byKeyId.set(session.keyId.toLowerCase(), session);

      /* -------- one row per registry entry -------- */
      const rows: PermissionRow[] = [];
      for (const record of records) {
        const local = byKeyId.get(record.keyId.toLowerCase()) ?? null;
        const derived = accountKeyHashFromPublicKey(record.publicKey);
        const keyHash = derived ?? local?.sessionKeyHash ?? null;
        const curve = keyCurveOf(record.publicKey);
        const kind: PermissionRow['kind'] = record.isRoot || curve === 'p256' ? 'root' : 'session';

        let spend: SpendInfo[] | null = null;
        let spendError: ChainReadError | null = null;
        let allowlist: AllowlistAnswer[] | null = null;
        let allowlistError: ChainReadError | null = null;

        if (keyHash && kind === 'session') {
          const [spendRead, allowRead] = await Promise.all([
            readSpendInfos(network, wallet, keyHash),
            probeAllowlist(network, wallet, keyHash, probes),
          ]);
          if (spendRead.ok) spend = spendRead.value;
          else spendError = spendRead;
          if (allowRead.ok) allowlist = allowRead.value;
          else allowlistError = allowRead;
        }

        rows.push({
          keyId: record.keyId,
          keystore: record,
          local,
          accountKey: keyHash ? (accountByHash.get(keyHash.toLowerCase()) ?? null) : null,
          accountKeyHash: keyHash,
          spend,
          spendError,
          allowlist,
          allowlistError,
          kind,
        });
      }

      /* -------- locally-known sessions the registry did not list -------- */
      const seen = new Set(rows.map((row) => row.keyId.toLowerCase()));
      for (const session of localSessions) {
        if (seen.has(session.keyId.toLowerCase())) continue;
        // Only meaningful when the registry read SUCCEEDED. If it failed, the
        // absence says nothing, and the page shows the failure instead.
        if (keystoreError) continue;

        const [spendRead, allowRead] = await Promise.all([
          readSpendInfos(network, wallet, session.sessionKeyHash),
          probeAllowlist(network, wallet, session.sessionKeyHash, probes),
        ]);
        rows.push({
          keyId: session.keyId,
          keystore: null,
          local: session,
          accountKey: accountByHash.get(session.sessionKeyHash.toLowerCase()) ?? null,
          accountKeyHash: session.sessionKeyHash,
          spend: spendRead.ok ? spendRead.value : null,
          spendError: spendRead.ok ? null : spendRead,
          allowlist: allowRead.ok ? allowRead.value : null,
          allowlistError: allowRead.ok ? null : allowRead,
          kind: 'session',
        });
      }

      // Root authority last: it is context, and the sessions are the subject.
      rows.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'root' ? 1 : -1));

      if (cancelled) return;
      setState({
        ...base,
        position: position.ok ? position.value : null,
        positionError: position.ok ? null : position,
        keystoreError,
        accountError: accountKeys.ok ? null : accountKeys,
        rows,
      });
    })();

    return () => {
      cancelled = true;
    };
    // `store.sessions` is intentionally not a dependency: a label edit should
    // not re-run seven chain reads. Grants and revokes call `refresh`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, network, chainId, wallet, nonce]);

  return {
    network,
    store,
    wallet: store.wallet,
    hydrated,
    storageOk,
    state: hydrated ? state : INITIAL,
    refresh,
  };
}
