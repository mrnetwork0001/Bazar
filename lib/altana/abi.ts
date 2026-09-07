/**
 * The two contracts a session key is written to, and how to read them back.
 *
 * A granted Altana session leaves a trace in two different places, and this
 * project shows both because they answer different questions:
 *
 *  1. **KeyStore** (`keyStore` in lib/altana/config.ts) is the public registry.
 *     It answers "does this key exist, who does it belong to, when does it
 *     expire, has it been revoked" for ANY reader - a counterparty, a tool, an
 *     agent runtime - without needing to know anything about the account. It
 *     does NOT store scope: `isValidKey` means registered AND unexpired AND
 *     unrevoked, and nothing more.
 *
 *  2. **The account contract** (the wallet address itself - Porto's
 *     IthacaAccount, which Altana's relay delegates to via EIP-7702) is where
 *     the constraints live and are enforced. `spendInfos` returns the live
 *     cap and how much of it has been spent, and `canExecute` answers whether
 *     a specific (target, calldata) is inside the allowlist. A call outside
 *     the grant reverts at validation time, before it executes.
 *
 * ---------------------------------------------------------------------------
 * PROVENANCE - none of these fragments were hand-written
 *
 * KEYSTORE_ABI and CONTROLLER_ABI are copied from
 * `@altananetwork/hypersigner-keystore-mcp@0.2.0`, `src/keystore.ts`, which is
 * Altana's own published source of truth for the registry ("reused by the MCP
 * server, the demo gating endpoint, the demo runner, and every test").
 *
 * ACCOUNT_ABI is copied from `porto@0.2.37`,
 * `src/core/internal/_generated/contracts/IthacaAccount.ts` - the generated ABI
 * of the deployed account, pinned by `@altananetwork/sdk`'s own dependency.
 *
 * SPEND_PERIODS mirrors porto's `fromSerializedSpendPeriod` (src/viem/Key.ts),
 * which is the enum ordering the account stores.
 *
 * `canExecutePackedInfos` is deliberately absent from ACCOUNT_ABI. It returns
 * the allowlist as packed bytes32 words, and the packing is not documented in
 * anything vendored here. Rather than guess at a bit layout, the UI probes the
 * allowlist with `canExecute`, which is an unambiguous boolean the account
 * itself computes.
 */

/** KeyStore.sol - the public registry of who is authorized. */
export const KEYSTORE_ABI = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getKeys',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bytes32[]' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'isValidKey',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'keyId', type: 'bytes32' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getKey',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'keyId', type: 'bytes32' },
    ],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'validator', type: 'address' },
          { name: 'publicKey', type: 'bytes' },
          { name: 'metadata', type: 'bytes' },
          { name: 'nonce', type: 'uint64' },
          { name: 'lastUpdated', type: 'uint64' },
          { name: 'revoked', type: 'bool' },
          { name: 'expiry', type: 'uint40' },
          { name: 'isRoot', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'revokeKey',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'keyId', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

/** KeyStoreController.sol - the registration fee and the payable entry points. */
export const KEYSTORE_CONTROLLER_ABI = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getRegistrationFeeInWei',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'registrationFeeUSD',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/**
 * IthacaAccount / GuardedExecutor - the enforcement side.
 *
 * `getKeys()` here takes no arguments, unlike KeyStore's: it is called ON the
 * wallet, and returns that wallet's own authorized keys with their expiries.
 */
export const ACCOUNT_ABI = [
  {
    type: 'function',
    name: 'getKeys',
    inputs: [],
    outputs: [
      {
        name: 'keys',
        type: 'tuple[]',
        components: [
          { name: 'expiry', type: 'uint40' },
          { name: 'keyType', type: 'uint8' },
          { name: 'isSuperAdmin', type: 'bool' },
          { name: 'publicKey', type: 'bytes' },
        ],
      },
      { name: 'keyHashes', type: 'bytes32[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canExecute',
    inputs: [
      { name: 'keyHash', type: 'bytes32' },
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'spendInfos',
    inputs: [{ name: 'keyHash', type: 'bytes32' }],
    outputs: [
      {
        name: 'results',
        type: 'tuple[]',
        components: [
          { name: 'token', type: 'address' },
          { name: 'period', type: 'uint8' },
          { name: 'limit', type: 'uint256' },
          { name: 'spent', type: 'uint256' },
          { name: 'lastUpdated', type: 'uint256' },
          { name: 'currentSpent', type: 'uint256' },
          { name: 'current', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const;

/** ERC-20 reads used for the wallet's balances. */
export const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
] as const;

/**
 * GuardedExecutor.SpendPeriod, by index. Mirrors porto's
 * `fromSerializedSpendPeriod`.
 */
export const SPEND_PERIODS = ['minute', 'hour', 'day', 'week', 'month', 'year'] as const;

export type SpendPeriod = (typeof SPEND_PERIODS)[number];

export function spendPeriodName(index: number): SpendPeriod | null {
  return SPEND_PERIODS[index] ?? null;
}

/**
 * IthacaAccount.KeyType, by index. Also from the generated Porto ABI
 * (`enum IthacaAccount.KeyType`): P256=0, WebAuthnP256=1, Secp256k1=2,
 * External=3.
 */
export const ACCOUNT_KEY_TYPES = ['P256', 'WebAuthnP256', 'Secp256k1', 'External'] as const;

export function accountKeyTypeName(index: number): string {
  return ACCOUNT_KEY_TYPES[index] ?? `unknown (${index})`;
}
