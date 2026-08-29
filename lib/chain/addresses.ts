/**
 * Verified BNB Chain contract addresses.
 *
 * Source of truth: the official BNB Agent Studio SDK (bnb-chain/bnbagent-sdk),
 * `python/bnbagent/config.py` and `python/bnbagent/networks/addresses.py`.
 * These are NOT guesses - they are the addresses the official SDK actually
 * calls, checked against its deployment manifest.
 *
 * Note on the registry: two ERC-8004 deployments exist on BSC. The canonical
 * `0x8004…` vanity deployment (used here) is the one BNB Agent Studio writes
 * to. BNB Chain's separate BRC8004 repo publishes different addresses
 * (0xfA09B339… / 0x17860530…) - do not index those, they are not what the
 * Studio registers against.
 */

import type { Address } from '@/lib/types';

export const BSC_MAINNET = 56;
export const BSC_TESTNET = 97;

/**
 * Bazar supports one network: BNB Smart Chain mainnet.
 *
 * The type is narrowed rather than merely defaulted, so a testnet chain id
 * cannot reach an index query, a slug, a job read or a signature by any path.
 * The testnet deployment is kept below as documentation of where the same
 * contracts live, but it is not part of the supported set.
 */
export type SupportedChainId = typeof BSC_MAINNET;

export interface ChainDeployment {
  chainId: SupportedChainId;
  name: string;
  /** ERC-8004 Identity Registry (upgradeable ERC-721) */
  identityRegistry: Address;
  /** ERC-8183 AgenticCommerce kernel (job escrow) - "APEX" proxy */
  agenticCommerce: Address;
  /** ERC-8183 EvaluatorRouter */
  evaluatorRouter: Address;
  /** ERC-8183 OptimisticPolicy */
  optimisticPolicy: Address;
  /** ERC-20 the commerce kernel settles in (EIP-3009 "United Stables") */
  paymentToken: Address;
  treasury: Address;
  explorer: string;
}

export const DEPLOYMENTS: Record<SupportedChainId, ChainDeployment> = {
  [BSC_MAINNET]: {
    chainId: BSC_MAINNET,
    name: 'BNB Smart Chain',
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    agenticCommerce: '0xea4daa3100a767e86fded867729ae7446476eba6',
    evaluatorRouter: '0x51895229e12f9876011789b04f8698af06ccd6da',
    optimisticPolicy: '0x9c01845705b3078aa2e8cff7520a6376fd766de5',
    paymentToken: '0xcE24439F2D9C6a2289F741120FE202248B666666',
    treasury: '0x000000000000000000000000000000000000dEaD',
    explorer: 'https://bscscan.com',
  },
};

/** EIP-712 domain of the payment token, verified onchain by the SDK. */
export const PAYMENT_TOKEN_EIP712 = { name: 'United Stables', version: '1' } as const;

/** Multicall3, same address on both networks. */
export const MULTICALL3: Address = '0xcA11bde05977b3631167028862bE2a173976CA11';

/** Bazar reads and settles on BNB Smart Chain mainnet. There is no override. */
export const DEFAULT_CHAIN_ID: SupportedChainId = BSC_MAINNET;

export function getDeployment(chainId: number = DEFAULT_CHAIN_ID): ChainDeployment {
  const d = DEPLOYMENTS[chainId as SupportedChainId];
  if (!d) throw new Error(`No BNB Chain deployment for chainId=${chainId}`);
  return d;
}

/**
 * The same ERC-8183 stack on BSC Testnet, kept for reference only.
 *
 * Bazar does not index, list, resolve or settle on testnet - see
 * SupportedChainId. This record exists so the addresses are not lost, and so
 * anyone extending Bazar to testnet has the verified values rather than
 * rediscovering them.
 */
export const BSC_TESTNET_REFERENCE = {
    chainId: BSC_TESTNET,
    name: 'BSC Testnet',
    identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    agenticCommerce: '0xa206c0517b6371c6638cd9e4a42cc9f02a33b0de',
    evaluatorRouter: '0xd7d36d66d2f1b608a0f943f722d27e3744f66f25',
    optimisticPolicy: '0xd6a4217588f6b1f5657a92a3e94e6422ad771cea',
    paymentToken: '0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565',
    treasury: '0x1001b2C085345f388778A975648aA50bcfd0D134',
    explorer: 'https://testnet.bscscan.com',
  
} as const;
