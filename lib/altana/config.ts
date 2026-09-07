/**
 * The Altana deployment Bazar talks to.
 *
 * ---------------------------------------------------------------------------
 * WHERE THESE ADDRESSES COME FROM
 *
 * Every value below is copied from `@altananetwork/sdk@0.9.0`'s own
 * `dist/config.js` (the `ETHEREUM` / `BNB` / `BNB_TESTNET` NetworkConfig
 * objects), which the SDK in turn sources from the Altana KeyStore deployment
 * manifests. They are duplicated here rather than imported because the read
 * path must work without pulling the SDK - the SDK is ESM-only and drags in
 * `porto` and `ox`, which belong in a lazily-imported browser chunk, not in
 * every module that wants to know a contract address.
 *
 * `assertSdkNetworkMatches` re-checks the copy against the SDK's own object at
 * the moment the SDK is loaded, so a version bump that moves an address is
 * caught loudly instead of silently reading the wrong contract.
 *
 * Verified against the live chains on 2026-09-07 with viem:
 *
 *   chain 56  KeyStore  0x6572…7E0a   17,514 bytes of code
 *             Controller 0x0834…A555   7,220 bytes, fee 0.000667231241071832 BNB
 *   chain 97  KeyStore  0x6b83…E94A   17,514 bytes of code
 *             Controller 0xb530…7e12   7,220 bytes, fee 0.000668291952695622 BNB
 *
 * The registration fee is `registrationFeeUSD` = 0.5e18 on both, converted to
 * BNB at call time - so it is read live, never assumed.
 *
 * ---------------------------------------------------------------------------
 * WHY BOTH CHAINS
 *
 * The Altana track asks for live onchain transactions "on testnet or mainnet".
 * BNB Smart Chain is where Bazar's agents actually are, so it is the default.
 * BSC Testnet is Altana's full-stack testnet (KeyStore + account stack + relay
 * all on chain 97) with a public faucet, so a session key can be granted,
 * registered, used and revoked there without spending real BNB.
 *
 * Hiring through a session key is mainnet-only, and `canHire` says so. A Bazar
 * listing is an ERC-8004 identity on chain 56; funding a testnet job against
 * that same address would escrow test funds for an agent whose registry never
 * vouched for it on that chain.
 */

import { bsc, bscTestnet } from 'viem/chains';
import type { Chain } from 'viem';

import type { Address } from '@/lib/types';

export type AltanaChainId = 56 | 97;

export interface AltanaNetwork {
  chainId: AltanaChainId;
  /** How the SDK names it, for the `assertSdkNetworkMatches` cross-check. */
  sdkExport: 'BNB' | 'BNB_TESTNET';
  name: string;
  shortName: string;
  chain: Chain;
  /** KeyStore registry - `getKeys`, `getKey`, `isValidKey`, `revokeKey`. */
  keyStore: Address;
  /** KeyStoreController - the payable `registerKey` entry points and the fee. */
  keyStoreController: Address;
  /** Read RPC. Overridable per environment; see `rpcUrl` below. */
  publicRpcUrl: string;
  explorer: string;
  /** Altana relay that carries intents for this chain. */
  relayUrl: string;
  /** Native gas symbol, used in the gas-allowance copy. */
  nativeSymbol: string;
  /** ERC-8183 stack, from the SDK's `ERC8183_ADDRESSES`. */
  erc8183: {
    commerce: Address;
    router: Address;
    policy: Address;
    registry: Address;
    paymentToken: Address;
  };
  /** True where a session key may fund a Bazar hire. Mainnet only - see above. */
  canHire: boolean;
  /** Whether the native token on this chain is worth real money. */
  liveFunds: boolean;
  /** Where to get gas, for the empty-wallet state. */
  faucetUrl: string | null;
}

export const ALTANA_MAINNET: AltanaNetwork = {
  chainId: 56,
  sdkExport: 'BNB',
  name: 'BNB Smart Chain',
  shortName: 'BNB Chain',
  chain: bsc,
  keyStore: '0x6572427ED530BadcF7375Cf9A4709D8d2b0E7E0a',
  keyStoreController: '0x0834Ee2C9BdC3E3efF0a2dC34393D4B0e546A555',
  publicRpcUrl: 'https://bsc-rpc.publicnode.com',
  explorer: 'https://bscscan.com',
  relayUrl: 'https://relay.altana.network',
  nativeSymbol: 'BNB',
  erc8183: {
    commerce: '0xEa4DAa3100A767e86FDed867729ae7446476EBA6',
    router: '0x51895229E12F9876011789B04f8698af06cCD6DA',
    policy: '0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5',
    registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    paymentToken: '0xcE24439F2D9C6a2289F741120FE202248B666666',
  },
  canHire: true,
  liveFunds: true,
  faucetUrl: null,
};

export const ALTANA_TESTNET: AltanaNetwork = {
  chainId: 97,
  sdkExport: 'BNB_TESTNET',
  name: 'BSC Testnet',
  shortName: 'BSC Testnet',
  chain: bscTestnet,
  keyStore: '0x6b8361C29d05D498b1a12B54A37310f94171E94A',
  keyStoreController: '0xb530D1971f5453F3359518343F05D0AedFfF7e12',
  publicRpcUrl: 'https://bsc-testnet-rpc.publicnode.com',
  explorer: 'https://testnet.bscscan.com',
  relayUrl: 'https://testnet-relay.altana.network',
  nativeSymbol: 'tBNB',
  erc8183: {
    commerce: '0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE',
    router: '0xD7d36D66d2F1B608A0F943f722D27e3744f66F25',
    policy: '0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA',
    registry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    paymentToken: '0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565',
  },
  canHire: false,
  liveFunds: false,
  faucetUrl: 'https://testnet.bnbchain.org/faucet-smart',
};

export const ALTANA_NETWORKS: Record<AltanaChainId, AltanaNetwork> = {
  56: ALTANA_MAINNET,
  97: ALTANA_TESTNET,
};

/** Every network in display order. Mainnet first: it is the default. */
export const ALTANA_NETWORK_LIST: readonly AltanaNetwork[] = [ALTANA_MAINNET, ALTANA_TESTNET];

export const DEFAULT_ALTANA_CHAIN_ID: AltanaChainId = 56;

export function isAltanaChainId(value: unknown): value is AltanaChainId {
  return value === 56 || value === 97;
}

export function getAltanaNetwork(chainId: AltanaChainId = DEFAULT_ALTANA_CHAIN_ID): AltanaNetwork {
  return ALTANA_NETWORKS[chainId];
}

/**
 * Read endpoint for a network.
 *
 * Mainnet honours the same `NEXT_PUBLIC_BSC_RPC_URL` the rest of Bazar uses, so
 * one paid endpoint covers every read path. `process.env.NEXT_PUBLIC_*` has to
 * be a literal member expression for Next to inline it into the client bundle.
 */
export function altanaRpcUrl(network: AltanaNetwork): string {
  if (network.chainId === 56) {
    const configured = process.env.NEXT_PUBLIC_BSC_RPC_URL?.trim();
    if (configured) return configured;
  } else {
    const configured = process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL?.trim();
    if (configured) return configured;
  }
  return network.publicRpcUrl;
}

export function altanaTxUrl(network: AltanaNetwork, hash: string): string {
  return `${network.explorer}/tx/${hash}`;
}

export function altanaAddressUrl(network: AltanaNetwork, address: string): string {
  return `${network.explorer}/address/${address}`;
}

/**
 * Cross-check this file against the SDK's own NetworkConfig.
 *
 * Called once, from the lazy SDK loader, with the SDK's exported object. If a
 * future SDK release redeploys the KeyStore, the mismatch surfaces here as a
 * thrown error naming both addresses rather than as reads against a contract
 * that no longer holds anyone's keys.
 */
export function assertSdkNetworkMatches(
  network: AltanaNetwork,
  sdkNetwork: { chainId: number; keyStore: string; keyStoreController: string; relayUrl?: string },
): void {
  const mismatches: string[] = [];
  if (sdkNetwork.chainId !== network.chainId) {
    mismatches.push(`chainId ${sdkNetwork.chainId} != ${network.chainId}`);
  }
  if (sdkNetwork.keyStore.toLowerCase() !== network.keyStore.toLowerCase()) {
    mismatches.push(`keyStore ${sdkNetwork.keyStore} != ${network.keyStore}`);
  }
  if (sdkNetwork.keyStoreController.toLowerCase() !== network.keyStoreController.toLowerCase()) {
    mismatches.push(
      `keyStoreController ${sdkNetwork.keyStoreController} != ${network.keyStoreController}`,
    );
  }
  if (mismatches.length > 0) {
    throw new Error(
      `[bazar/altana] @altananetwork/sdk's ${network.sdkExport} no longer matches lib/altana/config.ts: ` +
        `${mismatches.join('; ')}. Update lib/altana/config.ts before granting or reading any session.`,
    );
  }
}
