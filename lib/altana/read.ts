/**
 * Everything the permissions surface knows, it reads from the chain here.
 *
 * No function in this file invents a value, and none of them throw: a public
 * BSC endpoint that times out must surface as "the KeyStore could not be read",
 * never as an empty list of sessions. An empty list is a claim - it says the
 * user has authorized nothing - and that claim has to come from a successful
 * `getKeys` call or not at all.
 *
 * Reads are plain viem against the addresses in `./config`. The Altana SDK is
 * not imported here on purpose: it is ESM-only and pulls in porto and ox, which
 * belong in the lazily-loaded write chunk. Reading a registry needs an ABI and
 * an RPC, nothing more.
 */

import { createPublicClient, http, keccak256, padHex, encodeAbiParameters } from 'viem';
import type { Abi, Hex, PublicClient } from 'viem';
import { publicKeyToAddress } from 'viem/utils';

import { classifyChainError, type ChainReadError } from '@/lib/chain/client';
import type { Address } from '@/lib/types';

import {
  ACCOUNT_ABI,
  ERC20_BALANCE_ABI,
  KEYSTORE_ABI,
  KEYSTORE_CONTROLLER_ABI,
  spendPeriodName,
  type SpendPeriod,
} from './abi';
import { altanaRpcUrl, type AltanaNetwork } from './config';

/* ------------------------------------------------------------------ */
/* Result shape                                                        */
/* ------------------------------------------------------------------ */

export type AltanaRead<T> = { ok: true; value: T } | ChainReadError;

async function read<T>(fn: () => Promise<T>): Promise<AltanaRead<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return classifyChainError(error);
  }
}

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

const clients = new Map<number, PublicClient>();

export function altanaClient(network: AltanaNetwork): PublicClient {
  const hit = clients.get(network.chainId);
  if (hit) return hit;
  const created = createPublicClient({
    chain: network.chain,
    transport: http(altanaRpcUrl(network), { timeout: 20_000, retryCount: 2, retryDelay: 300 }),
    batch: { multicall: { batchSize: 512, wait: 16 } },
  }) as PublicClient;
  clients.set(network.chainId, created);
  return created;
}

/* ------------------------------------------------------------------ */
/* Key identity                                                        */
/* ------------------------------------------------------------------ */

/**
 * The id the KeyStore files a key under: `keccak256(publicKey)`, where
 * `publicKey` is the SEC1-uncompressed bytes for secp256k1 or the encoded P256
 * key for a passkey. Copied from `@altananetwork/sdk`'s
 * `internal/keystore.js#deriveKeyId`, which documents it as the v0 convention.
 */
export function keyIdFromPublicKey(publicKey: Hex): Hex {
  return keccak256(publicKey);
}

/**
 * The hash the ACCOUNT stores for a secp256k1 session key:
 * `keccak256(abi.encode(uint256(2), keccak256(abi.encode(address))))`, the
 * address left-padded to 32 bytes, keyType 2 = Secp256k1.
 *
 * This is a different value from the KeyStore's keyId, computed over a
 * different input, and the UI shows both rather than pretending a session has
 * one identifier. Copied from `@altananetwork/sdk`'s
 * `internal/erc1271.js#computeAccountSecp256k1KeyHash`.
 *
 * Passkey (WebAuthnP256) session keys hash differently - Porto's `Key.hash`
 * over the flat P256 key with keyType 1 - and are not derivable here without
 * porto, so `sessionKeyHash` is stored alongside a session rather than
 * recomputed for those.
 */
export function accountKeyHashForSecp256k1Address(address: Address): Hex {
  const publicKeyHash = keccak256(padHex(address, { size: 32 }));
  return keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'bytes32' }], [2n, publicKeyHash]));
}

/**
 * Which curve a KeyStore-stored public key is on, decided by its length.
 *
 * The registry stores opaque bytes and does not label them, but the two shapes
 * Altana writes are unambiguous: a secp256k1 session key is SEC1-uncompressed,
 * 65 bytes (`0x04 || x || y`), and a passkey admin key is the flat P256 form,
 * 64 bytes (`x || y`, no prefix). Anything else is reported as unknown rather
 * than guessed at.
 */
export type KeyCurve = 'secp256k1' | 'p256' | 'unknown';

export function keyCurveOf(publicKey: Hex): KeyCurve {
  const bytes = (publicKey.length - 2) / 2;
  if (bytes === 65 && publicKey.startsWith('0x04')) return 'secp256k1';
  if (bytes === 64) return 'p256';
  return 'unknown';
}

/**
 * The account-contract key hash for a key the KeyStore holds, where that can be
 * derived without the SDK.
 *
 * Only secp256k1 keys qualify: their hash is computed from the address, which
 * is a pure function of the public key. A passkey's hash goes through Porto's
 * `Key.hash` over the P256 key and is not reproduced here - which costs
 * nothing, because a passkey in this registry is the wallet's root authority
 * and root authorities have no scope to display.
 */
export function accountKeyHashFromPublicKey(publicKey: Hex): Hex | null {
  if (keyCurveOf(publicKey) !== 'secp256k1') return null;
  return accountKeyHashForSecp256k1Address(publicKeyToAddress(publicKey));
}

/* ------------------------------------------------------------------ */
/* KeyStore                                                            */
/* ------------------------------------------------------------------ */

/** One key as the public registry holds it. Every field is read, none inferred. */
export interface KeystoreRecord {
  keyId: Hex;
  validator: Address;
  publicKey: Hex;
  metadata: Hex;
  nonce: bigint;
  lastUpdated: bigint;
  revoked: boolean;
  /** Unix seconds. 0 means "never expires" - the KeyStore's own convention. */
  expiry: number;
  /** True for the wallet's root (admin) authority, false for a session key. */
  isRoot: boolean;
  /** `isValidKey`: registered AND unrevoked AND unexpired, per the contract. */
  valid: boolean;
}

/** The one-time fee the Controller charges to register a key, in native wei. */
export function readRegistrationFeeWei(network: AltanaNetwork): Promise<AltanaRead<bigint>> {
  return read(() =>
    altanaClient(network).readContract({
      address: network.keyStoreController,
      abi: KEYSTORE_CONTROLLER_ABI,
      functionName: 'getRegistrationFeeInWei',
    }),
  );
}

/**
 * Every key id the KeyStore has on file for this wallet.
 *
 * This is the list the permissions page is built from - not the browser's
 * notes. A key granted from another device still appears here, which is what
 * makes revocation from this page meaningful.
 */
export function readKeystoreKeyIds(
  network: AltanaNetwork,
  wallet: Address,
): Promise<AltanaRead<readonly Hex[]>> {
  return read(() =>
    altanaClient(network).readContract({
      address: network.keyStore,
      abi: KEYSTORE_ABI,
      functionName: 'getKeys',
      args: [wallet],
    }),
  );
}

/** The full registry record for every key id, in one multicall. */
export function readKeystoreRecords(
  network: AltanaNetwork,
  wallet: Address,
  keyIds: readonly Hex[],
): Promise<AltanaRead<KeystoreRecord[]>> {
  return read(async () => {
    if (keyIds.length === 0) return [];
    const client = altanaClient(network);
    const results = await client.multicall({
      allowFailure: false,
      contracts: keyIds.flatMap((keyId) => [
        {
          address: network.keyStore,
          abi: KEYSTORE_ABI as Abi,
          functionName: 'getKey',
          args: [wallet, keyId],
        },
        {
          address: network.keyStore,
          abi: KEYSTORE_ABI as Abi,
          functionName: 'isValidKey',
          args: [wallet, keyId],
        },
      ]),
    });

    return keyIds.map((keyId, index) => {
      const record = results[index * 2] as {
        validator: Address;
        publicKey: Hex;
        metadata: Hex;
        nonce: bigint;
        lastUpdated: bigint;
        revoked: boolean;
        expiry: number;
        isRoot: boolean;
      };
      const valid = results[index * 2 + 1] as boolean;
      return {
        keyId,
        validator: record.validator,
        publicKey: record.publicKey,
        metadata: record.metadata,
        nonce: record.nonce,
        lastUpdated: record.lastUpdated,
        revoked: record.revoked,
        expiry: Number(record.expiry),
        isRoot: record.isRoot,
        valid,
      } satisfies KeystoreRecord;
    });
  });
}

/* ------------------------------------------------------------------ */
/* The account contract                                                */
/* ------------------------------------------------------------------ */

export interface AccountKey {
  keyHash: Hex;
  /** Unix seconds; 0 = no expiry. */
  expiry: number;
  keyType: number;
  isSuperAdmin: boolean;
  publicKey: Hex;
}

/**
 * The keys the account itself will accept a signature from.
 *
 * An address that has never been delegated has no code and this call reverts;
 * that is reported as `call-failed`, which the UI renders as "this wallet has
 * not executed anything onchain yet" rather than as zero permissions.
 */
export function readAccountKeys(
  network: AltanaNetwork,
  wallet: Address,
): Promise<AltanaRead<AccountKey[]>> {
  return read(async () => {
    const [keys, keyHashes] = (await altanaClient(network).readContract({
      address: wallet,
      abi: ACCOUNT_ABI,
      functionName: 'getKeys',
    })) as [
      readonly { expiry: number; keyType: number; isSuperAdmin: boolean; publicKey: Hex }[],
      readonly Hex[],
    ];
    return keys.map((key, index) => ({
      keyHash: keyHashes[index] ?? ('0x' as Hex),
      expiry: Number(key.expiry),
      keyType: Number(key.keyType),
      isSuperAdmin: key.isSuperAdmin,
      publicKey: key.publicKey,
    }));
  });
}

/** A live spending cap, exactly as the account's GuardedExecutor holds it. */
export interface SpendInfo {
  token: Address;
  period: SpendPeriod | null;
  limit: bigint;
  /** Spent in the current period. */
  currentSpent: bigint;
  /** `limit - currentSpent`, clamped at zero. */
  remaining: bigint;
  /**
   * Start of the current spend period, as a Unix second. This is the tuple's
   * `current` field, which the name does not suggest - see above.
   */
  periodStart: bigint;
  lastUpdated: bigint;
}

/**
 * The spend caps attached to one key.
 *
 * `remaining` is computed here, not read. The tuple's last field is named
 * `current`, and it was taken for "currently available" - it is not. Measured
 * against the first session key ever granted (account
 * 0x087Cbf1d…7eEE, 2026-09-08), it returned 1788825600 for BOTH the native cap
 * and the U cap, identically. That is not an amount: it divides exactly by
 * 86400, and it is the start of the current daily period.
 *
 * Formatted as an 18-decimal balance it rendered as 0.0000000017888256, so a
 * key with its full 0.5 U untouched displayed as "< 0.0001 U left" - a session
 * that looks exhausted the instant it is created.
 *
 * The available figure is therefore `limit - currentSpent`, clamped, which is
 * the subtraction the old comment was proud of avoiding.
 */
export function readSpendInfos(
  network: AltanaNetwork,
  wallet: Address,
  keyHash: Hex,
): Promise<AltanaRead<SpendInfo[]>> {
  return read(async () => {
    const infos = (await altanaClient(network).readContract({
      address: wallet,
      abi: ACCOUNT_ABI,
      functionName: 'spendInfos',
      args: [keyHash],
    })) as readonly {
      token: Address;
      period: number;
      limit: bigint;
      spent: bigint;
      lastUpdated: bigint;
      currentSpent: bigint;
      current: bigint;
    }[];

    return infos.map((info) => ({
      token: info.token,
      period: spendPeriodName(Number(info.period)),
      limit: info.limit,
      currentSpent: info.currentSpent,
      // Clamped: a period rollover the account has not yet written back could
      // otherwise leave currentSpent above limit for an instant, and a negative
      // allowance is not a thing a reader should ever be shown.
      remaining: info.limit > info.currentSpent ? info.limit - info.currentSpent : 0n,
      periodStart: info.current,
      lastUpdated: info.lastUpdated,
    }));
  });
}

/** One allowlist question: may this key call `signature` on `to`? */
export interface AllowlistProbe {
  label: string;
  to: Address;
  /** Human-readable Solidity signature, shown next to the answer. */
  signature: string;
  /** Calldata used for the probe. Only the selector is consulted by the account. */
  data: Hex;
  /** True when the probe is expected to be refused - the control case. */
  control?: boolean;
}

export interface AllowlistAnswer extends AllowlistProbe {
  allowed: boolean;
}

/**
 * Ask the account, one call at a time, what this key is actually allowed to do.
 *
 * `canExecute(keyHash, target, data)` is the same check the account runs at
 * validation time, so the answers on screen are the enforcement itself rather
 * than a description of it. The probe list always carries a control entry - a
 * target that must come back `false` - because an allowlist that says yes to
 * everything looks identical to a working one until you ask it something it
 * should refuse.
 */
export function probeAllowlist(
  network: AltanaNetwork,
  wallet: Address,
  keyHash: Hex,
  probes: readonly AllowlistProbe[],
): Promise<AltanaRead<AllowlistAnswer[]>> {
  return read(async () => {
    const results = await altanaClient(network).multicall({
      allowFailure: false,
      contracts: probes.map((probe) => ({
        address: wallet,
        abi: ACCOUNT_ABI as Abi,
        functionName: 'canExecute',
        args: [keyHash, probe.to, probe.data],
      })),
    });
    return probes.map((probe, index) => ({ ...probe, allowed: Boolean(results[index]) }));
  });
}

/* ------------------------------------------------------------------ */
/* Wallet position                                                     */
/* ------------------------------------------------------------------ */

export interface WalletPosition {
  /** Native gas balance in wei. Relay fees and the registration fee come out of this. */
  native: bigint;
  /** Payment-token balance in the token's smallest unit. */
  token: bigint;
  tokenDecimals: number;
  tokenSymbol: string;
  /** Whether the address has contract code - i.e. has been delegated by the relay. */
  delegated: boolean;
}

export function readWalletPosition(
  network: AltanaNetwork,
  wallet: Address,
): Promise<AltanaRead<WalletPosition>> {
  return read(async () => {
    const client = altanaClient(network);
    const [native, code, token, decimals, symbol] = await Promise.all([
      client.getBalance({ address: wallet }),
      client.getBytecode({ address: wallet }),
      client.readContract({
        address: network.erc8183.paymentToken,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [wallet],
      }),
      client.readContract({
        address: network.erc8183.paymentToken,
        abi: ERC20_BALANCE_ABI,
        functionName: 'decimals',
      }),
      client.readContract({
        address: network.erc8183.paymentToken,
        abi: ERC20_BALANCE_ABI,
        functionName: 'symbol',
      }),
    ]);
    return {
      native,
      token: token as bigint,
      tokenDecimals: Number(decimals),
      tokenSymbol: String(symbol),
      delegated: Boolean(code && code !== '0x'),
    } satisfies WalletPosition;
  });
}

/**
 * The chain's own head timestamp, in seconds.
 *
 * Expiry is compared against `block.timestamp` by both the KeyStore and the
 * account, so every "has this expired" decision uses this rather than the
 * browser clock.
 */
export function readAltanaChainTime(network: AltanaNetwork): Promise<AltanaRead<number>> {
  return read(async () => {
    const block = await altanaClient(network).getBlock({ blockTag: 'latest' });
    return Number(block.timestamp);
  });
}
