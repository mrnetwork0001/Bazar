/**
 * Every write Bazar makes through Altana. All of them are lazy, and all of them
 * are the user's own signature.
 *
 * ---------------------------------------------------------------------------
 * WHY THE IMPORT IS DYNAMIC
 *
 * `@altananetwork/sdk` is ESM-only and pulls in `porto` and `ox`. None of that
 * belongs in the server bundle or in the first paint of a marketplace page, and
 * none of it is needed to READ a permission - `lib/altana/read.ts` does that
 * with plain viem. So the SDK is imported inside the handlers that need it, and
 * webpack keeps it in its own chunk.
 *
 * ---------------------------------------------------------------------------
 * WHY THE ADMIN AUTHORITY IS A PASSKEY AND NOT THE CONNECTED WALLET
 *
 * This is not a design preference, it is the SDK's stated constraint. From
 * `internal/signer.ts`:
 *
 *   "Injected browser wallets (MetaMask, Trust Wallet, Rabby, ...) are NOT a
 *    signer type: they refuse the two signatures the 7702 flow needs (the
 *    delegation authorization and raw relay digests). Browser users onboard
 *    with a passkey wallet and fund it from their extension wallet."
 *
 * So an Altana wallet in Bazar is a separate self-custodial smart account whose
 * admin authority is a WebAuthn passkey held by the operating system. Bazar
 * stores the credential's PUBLIC half so the signer can be rebuilt after a
 * reload; the private half never leaves the device's secure element, and every
 * admin action costs a biometric prompt.
 *
 * Session keys are the other half of the story: a fresh secp256k1 key,
 * generated in the browser, authorized onchain for a named set of calls, a
 * spending cap and an expiry. That key can then act without the passkey - which
 * is the whole point, and exactly why the constraints matter.
 */

import { generatePrivateKey } from 'viem/accounts';
import type { Hex } from 'viem';

import type { Address } from '@/lib/types';

import { assertSdkNetworkMatches, type AltanaNetwork } from './config';
import { accountKeyHashForSecp256k1Address, keyIdFromPublicKey } from './read';
import type { StoredPasskeyCredential, StoredSession, StoredWallet } from './session-store';
import type { HireScope } from './scope';

type Sdk = typeof import('@altananetwork/sdk');
type SdkNetwork = import('@altananetwork/sdk').NetworkConfig;
type ExecuteResult = import('@altananetwork/sdk').ExecuteResult;

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

let sdkPromise: Promise<Sdk> | null = null;

/** Load the SDK once per tab. Browser only - it needs WebAuthn and fetch. */
export function loadAltanaSdk(): Promise<Sdk> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('The Altana SDK only runs in the browser.'));
  }
  sdkPromise ??= import('@altananetwork/sdk');
  return sdkPromise;
}

/**
 * The SDK's own NetworkConfig for one of Bazar's networks, checked against
 * `lib/altana/config.ts` before it is used.
 *
 * If a future SDK release moves the KeyStore, this throws with both addresses
 * in the message rather than quietly reading a contract that holds nobody's
 * keys.
 */
export async function altanaSdkNetwork(network: AltanaNetwork): Promise<{ sdk: Sdk; sdkNetwork: SdkNetwork }> {
  const sdk = await loadAltanaSdk();
  const sdkNetwork = network.sdkExport === 'BNB' ? sdk.BNB : sdk.BNB_TESTNET;
  assertSdkNetworkMatches(network, sdkNetwork);
  return { sdk, sdkNetwork };
}

/* ------------------------------------------------------------------ */
/* The wallet                                                          */
/* ------------------------------------------------------------------ */

export interface CreatedWallet {
  address: Address;
  credential: StoredPasskeyCredential;
}

/**
 * Create a self-custodial Altana smart wallet, admin authority = a new passkey.
 *
 * Counterfactual on every network passed: an EIP-7702 delegation is prepared
 * and authorized with the relay, but nothing is mined and nothing is spent
 * until the wallet's first real action. The address is the same on each chain.
 */
export async function createAltanaPasskeyWallet(opts: {
  name: string;
  networks: readonly AltanaNetwork[];
}): Promise<CreatedWallet> {
  if (opts.networks.length === 0) throw new Error('At least one network is required.');
  const sdk = await loadAltanaSdk();
  const sdkNetworks = opts.networks.map((network) => {
    const sdkNetwork = network.sdkExport === 'BNB' ? sdk.BNB : sdk.BNB_TESTNET;
    assertSdkNetworkMatches(network, sdkNetwork);
    return sdkNetwork;
  });

  const client = sdk.createClient({ chains: sdkNetworks });
  const created = await client.createPasskeyWallet({ name: opts.name });

  if (created.signer.credential.kind !== 'webauthn') {
    throw new Error('Expected a WebAuthn passkey credential from createPasskeyWallet.');
  }
  return { address: created.address as Address, credential: created.signer.credential };
}

/**
 * Find a wallet from a passkey already on this device.
 *
 * Reads the wallet address out of the credential's user handle, then reads the
 * admin public key back from the KeyStore, so it only works once the wallet has
 * done something onchain - registration happens on the first admin action.
 */
export async function recoverAltanaWallet(network: AltanaNetwork): Promise<CreatedWallet> {
  const { sdk, sdkNetwork } = await altanaSdkNetwork(network);
  const client = sdk.createClient({ chains: [sdkNetwork] });
  const recovered = await client.recoverFromPasskey({ chainId: network.chainId });
  if (recovered.signer.credential.kind !== 'webauthn') {
    throw new Error('Expected a WebAuthn passkey credential from recoverFromPasskey.');
  }
  return { address: recovered.address as Address, credential: recovered.signer.credential };
}

/* ------------------------------------------------------------------ */
/* Granting                                                            */
/* ------------------------------------------------------------------ */

export interface GrantedSession {
  session: StoredSession;
  /** The relay's transaction, when it reported one. */
  transactionHash: string | null;
}

/**
 * Grant a session key scoped to the hire sequence.
 *
 * The session key is generated here, in the browser, and passed to the SDK as
 * `sessionSigner` rather than letting the SDK generate one: an SDK-generated
 * key exists only in that call's memory, and losing it strands a live onchain
 * authorization (the SDK logs a warning about precisely this).
 *
 * `register` is left at its default of true, which is what puts the key in the
 * KeyStore where any third party can verify it. That costs the Controller's
 * registration fee, in native gas, from the wallet.
 */
export async function grantHireSession(opts: {
  network: AltanaNetwork;
  wallet: StoredWallet;
  label: string;
  scope: HireScope;
  /** Unix seconds, computed from the chain's head timestamp. */
  expiry: number;
}): Promise<GrantedSession> {
  const { sdk, sdkNetwork } = await altanaSdkNetwork(opts.network);
  const client = sdk.createClient({ chains: [sdkNetwork] });

  const adminSigner = sdk.signerFromPasskey(opts.wallet.credential);
  const privateKey = generatePrivateKey();
  const sessionSigner = sdk.signerFromPrivateKey(privateKey);

  const granted = await client.grantSession({
    wallet: { address: opts.wallet.address },
    signer: adminSigner,
    sessionSigner,
    chainId: opts.network.chainId,
    expiry: opts.expiry,
    permissions: {
      calls: opts.scope.calls.map((call) => ({ to: call.to, signature: call.signature })),
      spend: opts.scope.spend.map((spend) =>
        spend.token
          ? { token: spend.token, limit: spend.limit, period: spend.period }
          : { limit: spend.limit, period: spend.period },
      ),
    },
  });

  const publicKey = granted.publicKey;
  const session: StoredSession = {
    keyId: keyIdFromPublicKey(publicKey),
    sessionKeyHash: accountKeyHashForSecp256k1Address(sessionSigner.address as Address),
    walletAddress: opts.wallet.address,
    chainId: opts.network.chainId,
    label: opts.label,
    publicKey,
    privateKey,
    permissions: {
      calls: opts.scope.calls,
      spend: opts.scope.spend.map((spend) => ({
        ...(spend.token ? { token: spend.token } : {}),
        limit: spend.limit.toString(),
        period: spend.period,
      })),
    },
    expiry: opts.expiry,
    grantTxHash: granted.transactionHash ?? null,
    grantedAtChainTime: null,
    revokeTxHash: null,
    runs: [],
  };

  return { session, transactionHash: granted.transactionHash ?? null };
}

/* ------------------------------------------------------------------ */
/* Revoking                                                            */
/* ------------------------------------------------------------------ */

/**
 * Revoke a session key onchain.
 *
 * Takes the session's PUBLIC key, not the session object, because the most
 * valuable case is revoking a key this browser has no secret for - one granted
 * on another device and found by reading the KeyStore. The public key is right
 * there in the registry record.
 *
 * One intent, two effects: the account drops the key's authority, and the
 * KeyStore entry is marked revoked so every other reader sees it too. Both land
 * in the same bundle. Revocation is monotonic - a revoked key cannot come back.
 */
export async function revokeAltanaSession(opts: {
  network: AltanaNetwork;
  wallet: StoredWallet;
  sessionPublicKey: Hex;
}): Promise<ExecuteResult> {
  const { sdk, sdkNetwork } = await altanaSdkNetwork(opts.network);
  const client = sdk.createClient({ chains: [sdkNetwork] });
  const adminSigner = sdk.signerFromPasskey(opts.wallet.credential);

  return client.revokeSession({
    wallet: { address: opts.wallet.address },
    signer: adminSigner,
    session: opts.sessionPublicKey,
    chainId: opts.network.chainId,
  });
}

/* ------------------------------------------------------------------ */
/* Hiring through a session key                                        */
/* ------------------------------------------------------------------ */

export interface SessionHireResult {
  jobId: bigint;
  callsId: string;
  transactionHash: string | null;
  status: ExecuteResult['status'];
  /** The address the kernel recorded as the job's client: the Altana wallet. */
  client: Address;
}

/**
 * Fund an ERC-8183 job using a session key instead of a wallet signature.
 *
 * `hireErc8183Agent` batches the whole buyer sequence - createJob, registerJob,
 * setBudget, approve, fund - into a single atomic relay intent signed by the
 * session key. Every one of those five calls has to be inside the session's
 * allowlist or the account rejects the bundle at validation time, and the
 * budget has to fit under the spend cap or the same thing happens. That is what
 * makes this a demonstration of the constraints rather than a description of
 * them.
 *
 * The job's client is the ALTANA WALLET, not the connected browser wallet. It
 * is the address that must hold the budget, and the only address the kernel
 * will let fund or refund the job.
 */
export async function hireThroughAltanaSession(opts: {
  network: AltanaNetwork;
  session: StoredSession;
  provider: Address;
  task: string;
  budget: bigint;
  deadlineSeconds: number;
}): Promise<SessionHireResult> {
  const { sdk, sdkNetwork } = await altanaSdkNetwork(opts.network);

  const signer = sdk.signerFromPrivateKey(opts.session.privateKey);
  if (signer.publicKey.toLowerCase() !== opts.session.publicKey.toLowerCase()) {
    throw new Error(
      'The stored session key does not match the public key it was granted for. ' +
        'Revoke this session and grant a new one.',
    );
  }

  const session = sdk.deserializeSession(
    {
      walletAddress: opts.session.walletAddress,
      publicKey: opts.session.publicKey,
      expiry: opts.session.expiry,
      permissions: {
        calls: opts.session.permissions.calls.map((call) => ({
          to: call.to,
          signature: call.signature,
        })),
        spend: opts.session.permissions.spend.map((spend) =>
          spend.token
            ? { token: spend.token, limit: spend.limit, period: spend.period }
            : { limit: spend.limit, period: spend.period },
        ),
      },
    },
    signer,
  );

  const result = await sdk.hireErc8183Agent(
    session,
    {
      provider: opts.provider,
      task: opts.task,
      budget: opts.budget,
      deadlineSeconds: opts.deadlineSeconds,
    },
    { network: sdkNetwork },
  );

  return {
    jobId: result.jobId,
    callsId: result.callsId,
    transactionHash: result.transactionHash ?? null,
    status: result.status,
    client: opts.session.walletAddress,
  };
}
