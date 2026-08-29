/**
 * Turning a failed write into something true that a person can read.
 *
 * Two rules govern this file.
 *
 * 1. Never soften a failure into a success. If a step did not happen, the UI
 *    says which step and why, and the reason comes from the chain rather than
 *    from a guess about what probably went wrong.
 * 2. Never invent a reason. Every custom error mapped below is one the
 *    AgenticCommerce ABI actually declares and, for the ones that matter, one
 *    that was provoked against the live kernel on 2026-08-28 by simulating the
 *    call that trips it. Anything unrecognised is reported verbatim - the raw
 *    error name is more honest than a friendly sentence that may be wrong.
 */

import {
  BaseError,
  ContractFunctionRevertedError,
  keccak256,
  slice,
  toBytes,
  UserRejectedRequestError,
  type Hex,
} from 'viem';

import {
  AGENTIC_COMMERCE_ABI,
  ERC20_ABI,
  EVALUATOR_ROUTER_ABI,
  IDENTITY_REGISTRY_ABI,
} from '@/lib/abi';

/* ------------------------------------------------------------------ */
/* Cross-contract error decoding                                       */
/* ------------------------------------------------------------------ */

/**
 * Selector -> error name, derived from the vendored ABIs.
 *
 * viem can only name a custom error that appears in the ABI of the contract
 * being CALLED, and the kernel's calls bubble reverts up from contracts it in
 * turn calls. Measured: funding a job whose policy is not registered reverts
 * with `0x32d53d69`, which the AgenticCommerce ABI does not declare - it is
 * `PolicyNotSet()`, thrown by the EvaluatorRouter inside the kernel's hook
 * call. Without this table the UI would have shown a bare four-byte selector
 * for the single most likely failure in the flow.
 *
 * Derived, never typed out: the signature is rebuilt from each ABI item's own
 * `name` and input `type`s, the same way `lib/abi/index.ts` derives its
 * function signatures. Items with tuple inputs are skipped, since a tuple's
 * canonical form needs expansion and none of these errors has one.
 */
const ERROR_NAMES: Record<string, string> = (() => {
  const table: Record<string, string> = {};
  const abis = [AGENTIC_COMMERCE_ABI, EVALUATOR_ROUTER_ABI, ERC20_ABI, IDENTITY_REGISTRY_ABI];
  for (const abi of abis) {
    for (const item of abi) {
      if (item.type !== 'error') continue;
      const inputs = (item.inputs ?? []) as readonly { type: string }[];
      if (inputs.some((input) => input.type.startsWith('tuple'))) continue;
      const signature = `${item.name}(${inputs.map((input) => input.type).join(',')})`;
      table[slice(keccak256(toBytes(signature)), 0, 4)] = item.name;
    }
  }
  return table;
})();

/** Name a raw four-byte revert selector, if any vendored ABI declares it. */
export function errorNameForSelector(selector: string | undefined): string | undefined {
  if (!selector) return undefined;
  return ERROR_NAMES[selector as Hex];
}

export type HireFailureKind =
  /** The wallet holder declined to sign. Recoverable, and not an error. */
  | 'rejected'
  /** The contract refused the call. We know exactly why. */
  | 'reverted'
  /** The transaction was mined and reverted onchain. */
  | 'reverted-onchain'
  /** Could not reach a node, or the node refused to answer. */
  | 'network'
  /** Something we could not classify. Reported raw rather than dressed up. */
  | 'unknown';

export interface HireFailure {
  kind: HireFailureKind;
  /** Short headline, e.g. "Signature declined". */
  title: string;
  /** One or two sentences. Already safe to render - never a stack trace. */
  detail: string;
  /** The Solidity custom error name, when the revert carried one. */
  errorName?: string;
}

/**
 * Custom errors declared by AgenticCommerce, in the wording a hirer needs.
 *
 * The four marked (provoked) were reproduced against the live testnet kernel by
 * simulating the exact call from the exact account that trips them, so the
 * mapping is measured rather than inferred from the name.
 */
const KERNEL_ERRORS: Record<string, string> = {
  // (provoked) fund() before setBudget: the kernel has no amount recorded.
  ZeroBudget:
    'The kernel has no budget recorded for this job, so there is nothing to fund. The budget step has to land first.',
  // (provoked) fund() with an expectedBudget that disagrees with storage.
  BudgetMismatch:
    'The budget recorded onchain is not the amount this call asserted. The kernel refuses to fund an amount you did not confirm.',
  // (provoked) fund()/setBudget() from an address that is not the job's client.
  Unauthorized: 'The kernel refused this call from this wallet. Only the job’s client may make it.',
  // (provoked) createJob() with expiredAt within 300s of the mining block.
  ExpiryTooShort:
    'The deadline is too close. The kernel requires an expiry more than five minutes past the block that mines the call.',
  ExpiryTooLong: 'The deadline is too far out. The kernel caps a job expiry at 365 days.',
  // (provoked) createJob() with hook = the zero address.
  HookRequired: 'The kernel requires a settlement hook. Creating a job without one is rejected.',
  // (provoked) createJob() with evaluator = the zero address.
  ZeroAddress: 'One of the addresses in this call was the zero address, which the kernel rejects.',
  WrongStatus:
    'The job is no longer in a state that accepts this call. It may already have moved on, or its expiry may have elapsed - the kernel treats an elapsed job as closed to funding even while it still reads as open.',
  InvalidJob: 'The kernel does not recognise that job id.',
  EnforcedPause: 'The kernel is paused. No job can be created or funded until the operator unpauses it.',
  ProviderAlreadySet: 'This job already has a provider set and the kernel will not change it.',
  ProviderNotSet: 'This job has no provider set yet.',
  HookCallFailed: 'The settlement hook rejected the call.',
  HookMissingInterface: 'The address passed as the settlement hook is not a settlement hook.',
  FeeTooHigh: 'The kernel rejected the fee on this call.',
  SafeERC20FailedOperation:
    'The payment token refused the transfer. Check the balance and the allowance granted to the kernel.',
  ReentrancyGuardReentrantCall: 'The kernel rejected a re-entrant call.',

  /* --- EvaluatorRouter. These reach the UI through the kernel's hook call. --- */
  // (provoked) fund() on a job whose policy was never registered with the router.
  PolicyNotSet:
    'No settlement policy is registered for this job on the EvaluatorRouter, so the kernel will not accept the escrow. The register step has to land first.',
  PolicyAlreadySet: 'This job already has a settlement policy registered with the EvaluatorRouter.',
  PolicyNotWhitelisted:
    'The EvaluatorRouter does not accept that settlement policy. Bazar registers the OptimisticPolicy deployed alongside the kernel, which the router lists as whitelisted on both chains.',
  // (provoked) registerJob() from an address that is not the job's client.
  NotJobClient: 'Only the wallet that created the job may register its settlement policy.',
  JobNotOpen: 'The job has moved past OPEN, and a settlement policy can only be registered while it is open.',
  RouterNotEvaluator: 'The job’s evaluator is not the EvaluatorRouter, so the router will not take it.',
  RouterNotHook: 'The job’s hook is not the EvaluatorRouter, so the router will not take it.',
  NotCommerce: 'The EvaluatorRouter refused a call that did not come from its own commerce kernel.',
  HasInflightJobs: 'The EvaluatorRouter has jobs in flight and refused this call.',
};

function isUserRejection(error: unknown): boolean {
  if (error instanceof UserRejectedRequestError) return true;
  if (error instanceof BaseError && error.walk((e) => e instanceof UserRejectedRequestError)) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  // MetaMask and most injected wallets surface 4001 / "user rejected"; some
  // wrap it deeply enough that the typed walk above misses it.
  return (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('request rejected') ||
    message.includes('4001')
  );
}

/**
 * Classify a thrown write/simulate error.
 *
 * `step` is the human name of what was being attempted ("create the job",
 * "fund the escrow"), so the message can say which step failed without the
 * caller having to restate it.
 */
export function describeWriteError(error: unknown, step: string): HireFailure {
  if (isUserRejection(error)) {
    return {
      kind: 'rejected',
      title: 'Signature declined',
      detail: `You declined the request to ${step} in your wallet. Nothing was sent.`,
    };
  }

  if (error instanceof BaseError) {
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError) as
      | ContractFunctionRevertedError
      | null;

    if (reverted) {
      // `data.errorName` is only populated when the called contract's own ABI
      // declares the error. Fall back to the cross-contract selector table so a
      // revert thrown by the router inside the kernel still gets a name.
      const name = reverted.data?.errorName ?? errorNameForSelector(reverted.signature);
      if (name) {
        return {
          kind: 'reverted',
          title: `Rejected by the contract`,
          detail:
            KERNEL_ERRORS[name] ??
            `The contract reverted with ${name}(), which this build does not have a plain-language explanation for.`,
          errorName: name,
        };
      }
      // Old-style string revert, e.g. the payment token's
      // "ERC20: insufficient allowance". Rendered verbatim: it is the token's
      // own words, and paraphrasing it would be a guess.
      const reason = reverted.reason;
      if (reason) {
        return {
          kind: 'reverted',
          title: 'Rejected by the contract',
          detail: `The contract reverted: "${reason}".`,
        };
      }
    }

    const short = error.shortMessage || error.message;
    const lower = short.toLowerCase();

    if (lower.includes('insufficient funds')) {
      return {
        kind: 'reverted',
        title: 'Not enough BNB for gas',
        detail:
          'This wallet cannot pay the gas for that transaction. Gas is paid in BNB, separately from the job budget, which is paid in U.',
      };
    }
    // viem's ChainMismatchError reads "The current chain of the wallet (id: N)
    // does not match the target chain for the transaction", so matching on the
    // word "mismatch" never fired and a wrong-network failure fell through to
    // the unknown branch with a raw viem string.
    if (
      lower.includes('chainmismatch') ||
      (lower.includes('chain') && lower.includes('mismatch')) ||
      (lower.includes('current chain') && lower.includes('does not match'))
    ) {
      return {
        kind: 'network',
        title: 'Wrong network',
        detail:
          'Your wallet moved to a different network mid-flow. Switch back and retry this step. ' +
          'Nothing was signed on the wrong chain.',
      };
    }
    if (
      lower.includes('http request failed') ||
      lower.includes('timed out') ||
      lower.includes('timeout') ||
      lower.includes('fetch failed')
    ) {
      return {
        kind: 'network',
        title: 'Could not reach the network',
        detail:
          `The RPC endpoint did not answer while trying to ${step}. If your wallet had not yet ` +
          'broadcast, nothing happened and you can retry. If it had, the transaction may still ' +
          'confirm - check your wallet or BscScan before retrying, because repeating a broadcast ' +
          'step can send it twice.',
      };
    }

    return { kind: 'unknown', title: 'The step did not complete', detail: short };
  }

  const raw = error instanceof Error ? error.message : String(error);
  return {
    kind: 'unknown',
    title: 'The step did not complete',
    detail: raw.split('\n')[0] || `Something went wrong trying to ${step}.`,
  };
}

/** A transaction that was mined and reverted. We have the hash; show it. */
export function minedRevertFailure(step: string): HireFailure {
  return {
    kind: 'reverted-onchain',
    title: 'The transaction reverted',
    detail: `The transaction to ${step} was mined and then reverted, so nothing it would have done took effect. The receipt is on BscScan.`,
  };
}
