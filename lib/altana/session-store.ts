/**
 * The browser's note of which Altana wallet and session keys belong to it.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS AUTHORITATIVE AND WHAT IS NOT
 *
 * Nothing in this file is authoritative about a permission. The KeyStore says
 * whether a key is registered, unexpired and unrevoked; the account contract
 * says what it may call and how much it may spend. Both are read live in
 * `./read`. This store exists for the two things the chain cannot give back:
 *
 *   1. The session's PRIVATE KEY. A granted session is an on-chain
 *      authorization for a public key; the matching secret only ever exists in
 *      the process that generated it. Lose it and the authorization is stranded
 *      until an admin revokes it (the SDK warns about exactly this). It is
 *      generated in this browser, written here, and never sent anywhere.
 *
 *   2. The label the user typed, and the local record of hires executed
 *      through each session, so a transaction hash can be found again.
 *
 * A session that exists on-chain but not in here is still shown by the
 * permissions page - read from the KeyStore, marked as having no key material
 * in this browser, and still revocable, because revocation is an admin action
 * that does not need the session key.
 *
 * ---------------------------------------------------------------------------
 * THE HONEST WARNING
 *
 * localStorage is readable by anything that can run script on this origin. That
 * is why the cap, the allowlist and the expiry exist: the key is bounded, and
 * the bound is enforced by a contract, not by the browser. The UI says this out
 * loud rather than implying the storage is a vault.
 */

import type { Hex } from 'viem';

import type { Address } from '@/lib/types';

import type { SpendPeriod } from './abi';
import { isAltanaChainId, type AltanaChainId } from './config';

/** Versioned, so a shape change can never be read as the old one. */
export const ALTANA_STORAGE_KEY = 'bazar.altana.v1';

/* ------------------------------------------------------------------ */
/* Shape                                                               */
/* ------------------------------------------------------------------ */

/**
 * The public half of a WebAuthn credential.
 *
 * Structurally the `webauthn` arm of the SDK's `PasskeyCredential`, which its
 * own types describe as "persistable ... apps can stringify it and drop it in
 * localStorage". There is no secret in here: the private key lives in the
 * device's secure element and every signature needs a biometric prompt. Storing
 * this is what lets the admin signer be rebuilt after a reload without a
 * discoverable-credential picker.
 */
export interface StoredPasskeyCredential {
  kind: 'webauthn';
  /** WebAuthn credential id, base64url - not hex. */
  id: string;
  /** Flat P256 public key (x || y), no 0x04 prefix. */
  publicKey: Hex;
  rpId?: string;
}

export interface StoredWallet {
  address: Address;
  /** The only admin authority Bazar creates. See `lib/altana/sdk.ts`. */
  admin: 'passkey';
  /** Label shown in the OS passkey prompt when this wallet was created. */
  name: string;
  credential: StoredPasskeyCredential;
  /** Networks the wallet was provisioned on when it was created. */
  chainIds: AltanaChainId[];
}

export interface StoredSpend {
  /** Absent means the native gas token. */
  token?: Address;
  /** Decimal string - JSON has no bigint. */
  limit: string;
  period: SpendPeriod;
}

export interface StoredCall {
  to: Address;
  signature: string;
  what: string;
}

/** One hire carried out through a session key. Mirrors the chain, never replaces it. */
export interface StoredRun {
  /** Decimal string. */
  jobId: string;
  /** The relay's bundle id. Always present. */
  callsId: string;
  /** The transaction the relay reported, when it reported one. */
  txHash: string | null;
  budgetWei: string;
  provider: string;
  agentSlug: string;
  agentName: string;
}

export interface StoredSession {
  /** KeyStore id: keccak256(publicKey). The primary key of this record. */
  keyId: Hex;
  /** The hash the account stores for this key. Different input, different value. */
  sessionKeyHash: Hex;
  walletAddress: Address;
  chainId: AltanaChainId;
  label: string;
  publicKey: Hex;
  /** Generated in this browser. Never transmitted. See the note at the top. */
  privateKey: Hex;
  permissions: { calls: StoredCall[]; spend: StoredSpend[] };
  /** Unix seconds, as granted. The chain is still what decides expiry. */
  expiry: number;
  grantTxHash: string | null;
  /** Chain head timestamp when the grant confirmed. Not a browser clock. */
  grantedAtChainTime: number | null;
  /** Set once a revoke has been submitted. The chain still decides. */
  revokeTxHash: string | null;
  runs: StoredRun[];
}

export interface AltanaStore {
  wallet: StoredWallet | null;
  sessions: StoredSession[];
}

const EMPTY: AltanaStore = { wallet: null, sessions: [] };

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function isHex(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value);
}

function isSpend(value: unknown): value is StoredSpend {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return typeof s.limit === 'string' && /^[0-9]+$/.test(s.limit) && typeof s.period === 'string';
}

function isCall(value: unknown): value is StoredCall {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return typeof c.to === 'string' && typeof c.signature === 'string' && typeof c.what === 'string';
}

function isRun(value: unknown): value is StoredRun {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.jobId === 'string' &&
    typeof r.callsId === 'string' &&
    typeof r.budgetWei === 'string' &&
    typeof r.provider === 'string' &&
    typeof r.agentSlug === 'string' &&
    typeof r.agentName === 'string'
  );
}

function isSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  const permissions = s.permissions as { calls?: unknown; spend?: unknown } | undefined;
  return (
    isHex(s.keyId) &&
    isHex(s.sessionKeyHash) &&
    typeof s.walletAddress === 'string' &&
    isAltanaChainId(s.chainId) &&
    typeof s.label === 'string' &&
    isHex(s.publicKey) &&
    isHex(s.privateKey) &&
    typeof s.expiry === 'number' &&
    typeof permissions === 'object' &&
    permissions !== null &&
    Array.isArray(permissions.calls) &&
    permissions.calls.every(isCall) &&
    Array.isArray(permissions.spend) &&
    permissions.spend.every(isSpend) &&
    Array.isArray(s.runs) &&
    s.runs.every(isRun)
  );
}

function isCredential(value: unknown): value is StoredPasskeyCredential {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return c.kind === 'webauthn' && typeof c.id === 'string' && isHex(c.publicKey);
}

function isWallet(value: unknown): value is StoredWallet {
  if (typeof value !== 'object' || value === null) return false;
  const w = value as Record<string, unknown>;
  return (
    typeof w.address === 'string' &&
    w.admin === 'passkey' &&
    typeof w.name === 'string' &&
    isCredential(w.credential) &&
    Array.isArray(w.chainIds) &&
    w.chainIds.every(isAltanaChainId)
  );
}

/* ------------------------------------------------------------------ */
/* Read and write                                                      */
/* ------------------------------------------------------------------ */

/** True when this browser will actually keep what is written. */
export function altanaStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const probe = `${ALTANA_STORAGE_KEY}.probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function readAltanaStore(): AltanaStore {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(ALTANA_STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const store = parsed as Record<string, unknown>;
    return {
      wallet: isWallet(store.wallet) ? store.wallet : null,
      sessions: Array.isArray(store.sessions) ? store.sessions.filter(isSession) : [],
    };
  } catch {
    return EMPTY;
  }
}

const listeners = new Set<() => void>();

function write(store: AltanaStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ALTANA_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private mode, quota, storage disabled. The grant is on the chain either
    // way - what is lost is the ability to USE the session key from this
    // browser, which `altanaStorageAvailable` warns about before granting.
  }
  listeners.forEach((listener) => listener());
}

/** Subscribe to local changes, including those made in another tab. */
export function subscribeToAltanaStore(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === ALTANA_STORAGE_KEY) listener();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

export function saveAltanaWallet(wallet: StoredWallet): void {
  const store = readAltanaStore();
  write({ ...store, wallet });
}

/**
 * Forget the wallet handle and every session key held for it.
 *
 * This does NOT revoke anything. It removes this browser's copy of the secrets
 * and labels; the authorizations stay live on-chain until they are revoked or
 * they expire, and the UI says so before running it.
 */
export function forgetAltanaWallet(): void {
  write(EMPTY);
}

export function saveAltanaSession(session: StoredSession): void {
  const store = readAltanaStore();
  const rest = store.sessions.filter((s) => s.keyId !== session.keyId);
  write({ ...store, sessions: [session, ...rest] });
}

export function patchAltanaSession(keyId: Hex, patch: Partial<StoredSession>): void {
  const store = readAltanaStore();
  const index = store.sessions.findIndex((s) => s.keyId === keyId);
  if (index < 0) return;
  const next = [...store.sessions];
  next[index] = { ...store.sessions[index]!, ...patch };
  write({ ...store, sessions: next });
}

/** Record a hire carried out through a session key. */
export function recordAltanaRun(keyId: Hex, run: StoredRun): void {
  const store = readAltanaStore();
  const index = store.sessions.findIndex((s) => s.keyId === keyId);
  if (index < 0) return;
  const session = store.sessions[index]!;
  const next = [...store.sessions];
  next[index] = { ...session, runs: [run, ...session.runs.filter((r) => r.jobId !== run.jobId)] };
  write({ ...store, sessions: next });
}

/**
 * Drop this browser's copy of one session's key material.
 *
 * Used after a confirmed revoke: keeping a secret for an authorization the
 * chain has already killed is pure downside.
 */
export function deleteAltanaSession(keyId: Hex): void {
  const store = readAltanaStore();
  write({ ...store, sessions: store.sessions.filter((s) => s.keyId !== keyId) });
}

/** Sessions this browser holds key material for, on one network. */
export function altanaSessionsFor(chainId: AltanaChainId, wallet?: Address): StoredSession[] {
  const store = readAltanaStore();
  const target = wallet?.toLowerCase();
  return store.sessions.filter(
    (s) => s.chainId === chainId && (!target || s.walletAddress.toLowerCase() === target),
  );
}
