/**
 * What a Bazar session key is allowed to do, and how that is proved.
 *
 * ---------------------------------------------------------------------------
 * THE SCOPE IS THE HIRE SEQUENCE, AND NOTHING ELSE
 *
 * Funding an ERC-8183 job takes exactly six contract calls, spread over three
 * contracts. A session key granted for hiring is allowed those six selectors on
 * those three addresses and nothing more:
 *
 *   AgenticCommerce  createJob     open a job against a provider
 *   EvaluatorRouter  registerJob   bind the settlement policy
 *   AgenticCommerce  setBudget     write the budget the fund step asserts
 *   payment token    approve       let the kernel pull the budget
 *   AgenticCommerce  fund          move the budget into escrow
 *   AgenticCommerce  claimRefund   pull the budget back out after the deadline
 *
 * `claimRefund` is in the list because it only ever pays the job's client,
 * which is the wallet itself - a key that can escrow funds should be able to
 * recover them without another admin signature. Notably absent: `submit`,
 * `settle` and `dispute`. Settlement releases escrow to the seller, and that is
 * not a decision a delegated key should be able to make on the buyer's behalf.
 * ERC-20 `transfer` is absent too: `approve` to the kernel is the only way this
 * key can move the payment token at all.
 *
 * Every signature below is derived from the ABIs already vendored in
 * `lib/abi/` with viem's `toFunctionSignature`, so the string handed to the
 * grant and the calldata handed to `canExecute` cannot drift apart, and neither
 * can drift from the ABI the hire path actually encodes.
 *
 * ---------------------------------------------------------------------------
 * THE SPEND CAPS
 *
 * Two, and both are enforced by the account contract rather than described by
 * this file:
 *
 *   payment token   what the key may ever escrow, per period
 *   native gas      what the key may spend on relay fees, per period
 *
 * The gas allowance comes first in the array on purpose. Porto treats the first
 * spend permission as the fee token for bundles signed by that key
 * (`resolvePermissions` in porto/src/viem/Key.ts), and a session with a token
 * cap but no native allowance is a session that can be refused at fee time.
 */

import { encodeFunctionData, toFunctionSignature } from 'viem';
import type { Abi, AbiFunction, Hex } from 'viem';

import { AGENTIC_COMMERCE_ABI, ERC20_ABI, EVALUATOR_ROUTER_ABI, NO_OPT_PARAMS } from '@/lib/abi';
import type { Address } from '@/lib/types';

import type { SpendPeriod } from './abi';
import type { AltanaNetwork } from './config';
import type { AllowlistProbe } from './read';

/* ------------------------------------------------------------------ */
/* Signatures, derived from the vendored ABIs                          */
/* ------------------------------------------------------------------ */

function signatureOf(abi: Abi, name: string): string {
  const item = abi.find(
    (entry): entry is AbiFunction => entry.type === 'function' && entry.name === name,
  );
  if (!item) throw new Error(`[bazar/altana] ABI has no function "${name}"`);
  return toFunctionSignature(item);
}

const COMMERCE_ABI = AGENTIC_COMMERCE_ABI as unknown as Abi;
const ROUTER_ABI = EVALUATOR_ROUTER_ABI as unknown as Abi;
const TOKEN_ABI = ERC20_ABI as unknown as Abi;

export const HIRE_SIGNATURES = {
  createJob: signatureOf(COMMERCE_ABI, 'createJob'),
  registerJob: signatureOf(ROUTER_ABI, 'registerJob'),
  setBudget: signatureOf(COMMERCE_ABI, 'setBudget'),
  approve: signatureOf(TOKEN_ABI, 'approve'),
  fund: signatureOf(COMMERCE_ABI, 'fund'),
  claimRefund: signatureOf(COMMERCE_ABI, 'claimRefund'),
} as const;

/* ------------------------------------------------------------------ */
/* The grant                                                           */
/* ------------------------------------------------------------------ */

/** One entry of the call allowlist, in the shape the SDK's grant takes. */
export interface ScopedCall {
  to: Address;
  signature: string;
  /** Plain-language description of what this one call does. */
  what: string;
}

/** One spending cap, in the shape the SDK's grant takes. */
export interface ScopedSpend {
  /** Omitted for the native token, which is how Porto identifies it. */
  token?: Address;
  limit: bigint;
  period: SpendPeriod;
}

export interface HireScope {
  calls: ScopedCall[];
  spend: ScopedSpend[];
}

export interface HireScopeInput {
  network: AltanaNetwork;
  /** Payment-token cap, in the token's smallest unit. */
  tokenLimit: bigint;
  tokenPeriod: SpendPeriod;
  /** Native gas cap, in wei. */
  gasLimit: bigint;
  gasPeriod: SpendPeriod;
}

/** The allowlist and caps for a hiring session on one network. */
export function buildHireScope(input: HireScopeInput): HireScope {
  const { commerce, router, paymentToken } = input.network.erc8183;
  return {
    calls: [
      {
        to: commerce,
        signature: HIRE_SIGNATURES.createJob,
        what: 'Open a job against a provider, with a description, deadline and evaluator.',
      },
      {
        to: router,
        signature: HIRE_SIGNATURES.registerJob,
        what: 'Bind the job to the optimistic settlement policy. Without it, funding reverts.',
      },
      {
        to: commerce,
        signature: HIRE_SIGNATURES.setBudget,
        what: 'Write the budget onto the job. The fund step asserts this exact number.',
      },
      {
        to: paymentToken,
        signature: HIRE_SIGNATURES.approve,
        what: 'Allow the kernel to pull the budget. This is the only token call in the grant.',
      },
      {
        to: commerce,
        signature: HIRE_SIGNATURES.fund,
        what: 'Move the budget into escrow. This is the call the spend cap bounds.',
      },
      {
        to: commerce,
        signature: HIRE_SIGNATURES.claimRefund,
        what: 'Pull the budget back after the deadline passes with no delivery. Pays the wallet.',
      },
    ],
    // Gas first: Porto uses the first spend permission as the bundle's fee token.
    spend: [
      { limit: input.gasLimit, period: input.gasPeriod },
      { token: paymentToken, limit: input.tokenLimit, period: input.tokenPeriod },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* The proof                                                           */
/* ------------------------------------------------------------------ */

/**
 * A target the grant deliberately excludes, used as the control probe.
 *
 * The ERC-8004 Identity Registry is the right choice: it is a real contract
 * this wallet might plausibly want to touch one day, it is not in the hire
 * scope, and `transferFrom` on it would move the agent's identity NFT. If the
 * account answers `true` to this, the allowlist is not doing its job and the
 * page says so instead of showing six reassuring ticks.
 */
const CONTROL_SIGNATURE = 'transferFrom(address,address,uint256)';

const CONTROL_SELECTOR_ARGS = [
  '0x0000000000000000000000000000000000000001',
  '0x0000000000000000000000000000000000000002',
  1n,
] as const;

/**
 * The questions the permissions page asks the account about a session key.
 *
 * Only the selector and the target matter to `canExecute`; the arguments are
 * filler that makes the calldata well-formed. They are never sent anywhere -
 * this is an `eth_call` against a view function.
 */
export function hireAllowlistProbes(network: AltanaNetwork): AllowlistProbe[] {
  const { commerce, router, paymentToken, registry } = network.erc8183;
  const dummy: Address = '0x0000000000000000000000000000000000000001';

  return [
    {
      label: 'Create a job',
      to: commerce,
      signature: HIRE_SIGNATURES.createJob,
      data: encodeFunctionData({
        abi: COMMERCE_ABI,
        functionName: 'createJob',
        args: [dummy, dummy, 1n, '', dummy],
      }),
    },
    {
      label: 'Register the settlement policy',
      to: router,
      signature: HIRE_SIGNATURES.registerJob,
      data: encodeFunctionData({ abi: ROUTER_ABI, functionName: 'registerJob', args: [1n, dummy] }),
    },
    {
      label: 'Set the budget',
      to: commerce,
      signature: HIRE_SIGNATURES.setBudget,
      data: encodeFunctionData({
        abi: COMMERCE_ABI,
        functionName: 'setBudget',
        args: [1n, 1n, NO_OPT_PARAMS],
      }),
    },
    {
      label: 'Approve the kernel to pull the budget',
      to: paymentToken,
      signature: HIRE_SIGNATURES.approve,
      data: encodeFunctionData({ abi: TOKEN_ABI, functionName: 'approve', args: [dummy, 1n] }),
    },
    {
      label: 'Fund the escrow',
      to: commerce,
      signature: HIRE_SIGNATURES.fund,
      data: encodeFunctionData({
        abi: COMMERCE_ABI,
        functionName: 'fund',
        args: [1n, 1n, NO_OPT_PARAMS],
      }),
    },
    {
      label: 'Claim a refund after the deadline',
      to: commerce,
      signature: HIRE_SIGNATURES.claimRefund,
      data: encodeFunctionData({ abi: COMMERCE_ABI, functionName: 'claimRefund', args: [1n] }),
    },
    {
      label: 'Transfer the agent identity NFT',
      to: registry,
      signature: CONTROL_SIGNATURE,
      data: encodeControlProbe(),
      control: true,
    },
  ];
}

function encodeControlProbe(): Hex {
  return encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'transferFrom',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
        ],
        outputs: [],
      },
    ] as const,
    functionName: 'transferFrom',
    args: CONTROL_SELECTOR_ARGS,
  });
}
