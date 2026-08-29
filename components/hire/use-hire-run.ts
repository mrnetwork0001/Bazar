'use client';

/**
 * The write path: four real transactions against the ERC-8183 AgenticCommerce
 * kernel, in the order the kernel actually requires.
 *
 * ---------------------------------------------------------------------------
 * WHY FOUR AND NOT TWO
 *
 * `createJob` takes no budget, and `fund`'s second argument is not the amount
 * being paid - it is an ASSERTION about the amount already recorded onchain.
 * Provoked against the live testnet kernel on 2026-08-28:
 *
 *   fund() on an open job with no budget      -> ZeroBudget()
 *   fund() with a mismatched expectedBudget   -> BudgetMismatch()
 *   fund() from an address that is not client -> Unauthorized()
 *   fund() with the budget set, no allowance  -> "ERC20: insufficient allowance"
 *   setBudget() from the client on an open job-> passes
 *   setBudget() from anyone else              -> Unauthorized()
 *
 * There is a fifth requirement that no signature in the AgenticCommerce ABI
 * hints at. `fund` calls the job's hook, which is the EvaluatorRouter, and the
 * router reverts `PolicyNotSet()` - selector `0x32d53d69`, a name that does not
 * appear in the kernel's ABI at all - unless the job has been registered
 * against a settlement policy first. Measured on 2026-08-28:
 *
 *   testnet #723, budget set, jobPolicy == 0        -> fund reverts 0x32d53d69
 *   every job on either chain that ever reached FUNDED has jobPolicy != 0
 *   EvaluatorRouter.registerJob(jobId, policy)      -> passes from the client
 *   the same call from any other address            -> NotJobClient()
 *   policyWhitelist(OptimisticPolicy)               -> true on both chains
 *
 * So the sequence is createJob -> registerJob -> setBudget -> approve -> fund.
 * `registerJob` and `setBudget` are order-independent (testnet #723 had a
 * budget before any policy, and mainnet #56660 took a budget with none), but
 * registering immediately after creation keeps the job coherent from the
 * earliest possible moment. The approve is skipped when the kernel's existing
 * allowance already covers the budget, which is re-read immediately before that
 * step rather than assumed from the value the form was rendered with.
 *
 * ---------------------------------------------------------------------------
 * EVERY STEP IS SIMULATED BEFORE IT IS SIGNED
 *
 * Each call is run through `eth_call` from the hirer's own address first. A
 * revert therefore surfaces as its real Solidity error - ZeroBudget,
 * BudgetMismatch, WrongStatus, ExpiryTooShort - with no wallet popup and no
 * gas spent, instead of as a failed transaction the user paid for. Only a call
 * that the chain says will succeed is ever put in front of the wallet.
 *
 * ---------------------------------------------------------------------------
 * THE JOB ID IS READ, NOT GUESSED
 *
 * `jobCounter` races: the mainnet kernel is in production use by other projects
 * and sat at 56,665 while this was being built, with testnet moving three ids
 * during a single session. The id is parsed out of the `JobCreated` log in this
 * transaction's own receipt, matched on the indexed `client` topic. If the
 * receipt confirms and carries no such log, the run stops and says so rather
 * than proceeding against an id it inferred.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseEventLogs, type Hex, type TransactionReceipt } from 'viem';
import { useWriteContract } from 'wagmi';

import { AGENTIC_COMMERCE_ABI, ERC20_ABI, EVALUATOR_ROUTER_ABI, NO_OPT_PARAMS } from '@/lib/abi';
import { getDeployment, type SupportedChainId } from '@/lib/chain/addresses';
import { getPublicClient } from '@/lib/chain/client';
import type { Address } from '@/lib/types';
import { describeWriteError, minedRevertFailure, type HireFailure } from './hire-errors';
import { recordHireReceipt, updateHireReceipt } from './job-receipts';

/* ------------------------------------------------------------------ */
/* Shape                                                               */
/* ------------------------------------------------------------------ */

export type HireStepId = 'create' | 'register' | 'budget' | 'approve' | 'fund';

export type HireStepStatus =
  /** Not started. */
  | 'idle'
  /** Being checked against the chain with `eth_call`. No wallet request yet. */
  | 'simulating'
  /** The wallet has been asked to sign and has not answered. */
  | 'awaiting-signature'
  /** Broadcast. Waiting for it to be mined. */
  | 'confirming'
  /** Mined, and it did what it said. */
  | 'confirmed'
  /** Not needed - the chain says this step is already satisfied. */
  | 'skipped'
  /** It did not happen, and `failure` says why. */
  | 'failed';

export interface HireStepState {
  id: HireStepId;
  status: HireStepStatus;
  txHash: Hex | null;
  failure: HireFailure | null;
}

export interface HireRunState {
  /** In execution order. `approve` is present until it is known to be unnecessary. */
  steps: HireStepState[];
  /** Parsed from the `JobCreated` log. Null until `createJob` has confirmed. */
  jobId: bigint | null;
  /** The step currently doing something, or null when idle/finished. */
  activeStep: HireStepId | null;
  /** True once `fund` has confirmed. The only thing that may be called success. */
  settled: boolean;
  running: boolean;
}

export interface HireRunParams {
  chainId: SupportedChainId;
  /** The connected wallet. Becomes the kernel's `client`. */
  client: Address;
  /** The agent's wallet, resolved from the ERC-8004 Identity Registry. */
  provider: Address;
  /** EvaluatorRouter. Passed as both `evaluator` and `hook`, matching real jobs. */
  evaluator: Address;
  description: string;
  /** Seconds from the mining block. Converted to an absolute `expiredAt` at send time. */
  durationSeconds: number;
  /** Budget in the payment token's smallest unit. */
  budgetWei: bigint;
  agentSlug: string;
  agentName: string;
}

const STEP_VERB: Record<HireStepId, string> = {
  create: 'create the job',
  register: 'register the settlement policy',
  budget: 'record the budget',
  approve: 'approve the kernel to move your U',
  fund: 'fund the escrow',
};

const INITIAL_STEPS: HireStepState[] = [
  { id: 'create', status: 'idle', txHash: null, failure: null },
  { id: 'register', status: 'idle', txHash: null, failure: null },
  { id: 'budget', status: 'idle', txHash: null, failure: null },
  { id: 'approve', status: 'idle', txHash: null, failure: null },
  { id: 'fund', status: 'idle', txHash: null, failure: null },
];

const INITIAL_STATE: HireRunState = {
  steps: INITIAL_STEPS,
  jobId: null,
  activeStep: null,
  settled: false,
  running: false,
};

/** How long to wait for a receipt before saying so. The tx is not lost, we stopped watching. */
const RECEIPT_TIMEOUT_MS = 180_000;

/** `jobPolicy` returns this for a job the router has never seen. */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useHireRun() {
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<HireRunState>(INITIAL_STATE);

  /**
   * Bumped by `reset` and on unmount. A run whose generation is stale stops
   * writing state, so closing the dialog mid-flight cannot resurrect it.
   */
  const generation = useRef(0);
  const busy = useRef(false);
  /** Survives re-render so a retry resumes rather than recreating the job. */
  const jobIdRef = useRef<bigint | null>(null);
  /**
   * Steps that are settled for this run. Held in a ref, not read back off
   * `state`: a retry must resume from the real position, and a state snapshot
   * captured when `run` was created would be one render behind.
   */
  const doneRef = useRef<Set<HireStepId>>(new Set());

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  const reset = useCallback(() => {
    generation.current += 1;
    busy.current = false;
    jobIdRef.current = null;
    doneRef.current = new Set();
    setState(INITIAL_STATE);
  }, []);

  const run = useCallback(
    async (params: HireRunParams) => {
      if (busy.current) return;
      busy.current = true;
      const mine = generation.current;
      const live = () => mine === generation.current;

      const publicClient = getPublicClient(params.chainId);
      const deployment = getDeployment(params.chainId);
      const kernel = deployment.agenticCommerce;
      const token = deployment.paymentToken;
      const router = deployment.evaluatorRouter;
      const policy = deployment.optimisticPolicy;

      const patch = (id: HireStepId, next: Partial<HireStepState>) => {
        if (!live()) return;
        setState((prev) => ({
          ...prev,
          steps: prev.steps.map((s) => (s.id === id ? { ...s, ...next } : s)),
        }));
      };

      const fail = (id: HireStepId, failure: HireFailure) => {
        if (!live()) return;
        setState((prev) => ({
          ...prev,
          activeStep: null,
          running: false,
          steps: prev.steps.map((s) => (s.id === id ? { ...s, status: 'failed', failure } : s)),
        }));
      };

      /** Wait for a receipt, distinguishing "reverted onchain" from "still unknown". */
      const confirm = async (id: HireStepId, hash: Hex): Promise<TransactionReceipt | null> => {
        patch(id, { status: 'confirming', txHash: hash });
        try {
          const receipt = await publicClient.waitForTransactionReceipt({
            hash,
            timeout: RECEIPT_TIMEOUT_MS,
            pollingInterval: 2_000,
          });
          if (receipt.status !== 'success') {
            fail(id, minedRevertFailure(STEP_VERB[id]));
            return null;
          }
          return receipt;
        } catch (error) {
          fail(id, describeWriteError(error, `confirm the transaction to ${STEP_VERB[id]}`));
          return null;
        }
      };

      if (live()) {
        setState((prev) => ({
          ...prev,
          running: true,
          steps: prev.steps.map((s) => (s.status === 'failed' ? { ...s, status: 'idle', failure: null } : s)),
        }));
      }

      try {
        /* ---------------- 1. createJob ---------------- */
        if (jobIdRef.current === null) {
          if (live()) setState((prev) => ({ ...prev, activeStep: 'create' }));
          patch('create', { status: 'simulating', failure: null });

          let expiredAt: bigint;
          try {
            // Read the head immediately before sending. `ExpiryTooShort()` is
            // measured against the timestamp of the block that MINES the call,
            // not the one the form was rendered against.
            const block = await publicClient.getBlock({ blockTag: 'latest' });
            expiredAt = block.timestamp + BigInt(params.durationSeconds);
          } catch (error) {
            fail('create', describeWriteError(error, 'read the current block before creating the job'));
            return;
          }

          const createArgs = [
            params.provider,
            params.evaluator,
            expiredAt,
            params.description,
            // The hook is the EvaluatorRouter, matching every real job observed
            // on both chains (mainnet 56664: evaluator == hook == the router).
            // The kernel reverts HookRequired() on the zero address.
            params.evaluator,
          ] as const;

          try {
            await publicClient.simulateContract({
              address: kernel,
              abi: AGENTIC_COMMERCE_ABI,
              functionName: 'createJob',
              args: createArgs,
              account: params.client,
            });
          } catch (error) {
            fail('create', describeWriteError(error, STEP_VERB.create));
            return;
          }
          if (!live()) return;

          patch('create', { status: 'awaiting-signature' });
          let hash: Hex;
          try {
            hash = await writeContractAsync({
              chainId: params.chainId,
              address: kernel,
              abi: AGENTIC_COMMERCE_ABI,
              functionName: 'createJob',
              args: createArgs,
            });
          } catch (error) {
            fail('create', describeWriteError(error, STEP_VERB.create));
            return;
          }

          const receipt = await confirm('create', hash);
          if (!receipt || !live()) return;

          // The id comes from this receipt's own JobCreated log, matched on the
          // indexed client topic. jobCounter is never consulted: it races.
          const created = parseEventLogs({
            abi: AGENTIC_COMMERCE_ABI,
            eventName: 'JobCreated',
            logs: receipt.logs,
          }).filter(
            (log) =>
              log.address.toLowerCase() === kernel.toLowerCase() &&
              log.args.client?.toLowerCase() === params.client.toLowerCase(),
          );

          const newJobId = created[0]?.args.jobId;
          if (typeof newJobId !== 'bigint') {
            fail('create', {
              kind: 'unknown',
              title: 'The job id could not be read',
              detail:
                'The transaction confirmed, but its receipt carries no JobCreated event from the kernel for this wallet. Bazar will not guess an id from jobCounter, so the run stops here. The transaction hash below is real - check it on BscScan.',
            });
            return;
          }

          jobIdRef.current = newJobId;
          doneRef.current.add('create');
          if (live()) setState((prev) => ({ ...prev, jobId: newJobId }));
          patch('create', { status: 'confirmed' });

          recordHireReceipt({
            chainId: params.chainId,
            jobId: newJobId.toString(),
            client: params.client.toLowerCase(),
            provider: params.provider.toLowerCase(),
            agentSlug: params.agentSlug,
            agentName: params.agentName,
            budgetWei: params.budgetWei.toString(),
            createTxHash: hash,
            registerTxHash: null,
            budgetTxHash: null,
            approveTxHash: null,
            fundTxHash: null,
            createdAtBlock: receipt.blockNumber.toString(),
          });
        }

        const jobId = jobIdRef.current;
        if (jobId === null) return;

        /* ---------------- 2. registerJob ---------------- */
        // Without this the router refuses the kernel's hook call on fund with
        // PolicyNotSet(). Skipped when a policy is already registered, which is
        // also what keeps a retry from tripping PolicyAlreadySet().
        const registerDone = await stepIfNeeded({
          id: 'register',
          live,
          setState,
          patch,
          fail,
          confirm,
          done: doneRef.current,
          shouldSkip: async () => {
            const current = (await publicClient.readContract({
              address: router,
              abi: EVALUATOR_ROUTER_ABI,
              functionName: 'jobPolicy',
              args: [jobId],
            })) as Address;
            return current.toLowerCase() !== ZERO_ADDRESS;
          },
          simulate: () =>
            publicClient.simulateContract({
              address: router,
              abi: EVALUATOR_ROUTER_ABI,
              functionName: 'registerJob',
              args: [jobId, policy],
              account: params.client,
            }),
          send: () =>
            writeContractAsync({
              chainId: params.chainId,
              address: router,
              abi: EVALUATOR_ROUTER_ABI,
              functionName: 'registerJob',
              args: [jobId, policy],
            }),
          onConfirmed: (hash) =>
            updateHireReceipt(params.chainId, jobId.toString(), { registerTxHash: hash }),
        });
        if (!registerDone || !live()) return;

        /* ---------------- 3. setBudget ---------------- */
        // `fund` reverts ZeroBudget() without this, and BudgetMismatch() if the
        // recorded amount is not exactly what `fund` asserts.
        const budgetDone = await stepIfNeeded({
          id: 'budget',
          live,
          setState,
          patch,
          fail,
          confirm,
          done: doneRef.current,
          shouldSkip: async () => {
            const recorded = (await publicClient.readContract({
              address: kernel,
              abi: AGENTIC_COMMERCE_ABI,
              functionName: 'getJob',
              args: [jobId],
            })) as unknown as { budget: bigint };
            // Re-running the flow against a job whose budget already matches is
            // a no-op, not a second transaction.
            return recorded.budget === params.budgetWei;
          },
          simulate: () =>
            publicClient.simulateContract({
              address: kernel,
              abi: AGENTIC_COMMERCE_ABI,
              functionName: 'setBudget',
              args: [jobId, params.budgetWei, NO_OPT_PARAMS],
              account: params.client,
            }),
          send: () =>
            writeContractAsync({
              chainId: params.chainId,
              address: kernel,
              abi: AGENTIC_COMMERCE_ABI,
              functionName: 'setBudget',
              args: [jobId, params.budgetWei, NO_OPT_PARAMS],
            }),
          onConfirmed: (hash) =>
            updateHireReceipt(params.chainId, jobId.toString(), { budgetTxHash: hash }),
        });
        if (!budgetDone || !live()) return;

        /* ---------------- 4. approve ---------------- */
        // `fund` performs a transferFrom, so the kernel needs an allowance. The
        // approval is for exactly the budget and is consumed by the next step.
        const approveDone = await stepIfNeeded({
          id: 'approve',
          live,
          setState,
          patch,
          fail,
          confirm,
          done: doneRef.current,
          shouldSkip: async () => {
            const allowance = (await publicClient.readContract({
              address: token,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [params.client, kernel],
            })) as bigint;
            return allowance >= params.budgetWei;
          },
          simulate: () =>
            publicClient.simulateContract({
              address: token,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [kernel, params.budgetWei],
              account: params.client,
            }),
          send: () =>
            writeContractAsync({
              chainId: params.chainId,
              address: token,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [kernel, params.budgetWei],
            }),
          onConfirmed: (hash) =>
            updateHireReceipt(params.chainId, jobId.toString(), { approveTxHash: hash }),
        });
        if (!approveDone || !live()) return;

        /* ---------------- 5. fund ---------------- */
        const fundDone = await stepIfNeeded({
          id: 'fund',
          live,
          setState,
          patch,
          fail,
          confirm,
          done: doneRef.current,
          shouldSkip: async () => false,
          simulate: () =>
            publicClient.simulateContract({
              address: kernel,
              abi: AGENTIC_COMMERCE_ABI,
              functionName: 'fund',
              args: [jobId, params.budgetWei, NO_OPT_PARAMS],
              account: params.client,
            }),
          send: () =>
            writeContractAsync({
              chainId: params.chainId,
              address: kernel,
              abi: AGENTIC_COMMERCE_ABI,
              functionName: 'fund',
              args: [jobId, params.budgetWei, NO_OPT_PARAMS],
            }),
          onConfirmed: (hash) => updateHireReceipt(params.chainId, jobId.toString(), { fundTxHash: hash }),
        });
        if (!fundDone || !live()) return;

        if (live()) setState((prev) => ({ ...prev, settled: true, activeStep: null, running: false }));
      } finally {
        busy.current = false;
        if (live()) setState((prev) => (prev.settled ? prev : { ...prev, running: false }));
      }
    },
    [writeContractAsync],
  );

  return { state, run, reset };
}

/* ------------------------------------------------------------------ */
/* One step                                                            */
/* ------------------------------------------------------------------ */

interface StepArgs {
  id: HireStepId;
  live: () => boolean;
  setState: React.Dispatch<React.SetStateAction<HireRunState>>;
  patch: (id: HireStepId, next: Partial<HireStepState>) => void;
  fail: (id: HireStepId, failure: HireFailure) => void;
  confirm: (id: HireStepId, hash: Hex) => Promise<TransactionReceipt | null>;
  /** Steps already settled in this run, so a retry resumes instead of repeating. */
  done: Set<HireStepId>;
  /** Re-read the chain and decide whether this step is unnecessary right now. */
  shouldSkip: () => Promise<boolean>;
  simulate: () => Promise<unknown>;
  send: () => Promise<Hex>;
  onConfirmed: (hash: Hex) => void;
}

/**
 * Simulate, sign, confirm - or skip, when the chain says the step is already
 * satisfied. Returns false the moment anything fails, so the caller stops.
 */
async function stepIfNeeded(args: StepArgs): Promise<boolean> {
  const { id, live, setState, patch, fail, confirm } = args;
  if (args.done.has(id)) return true;
  if (!live()) return false;

  setState((prev) => ({ ...prev, activeStep: id }));
  patch(id, { status: 'simulating', failure: null });

  try {
    if (await args.shouldSkip()) {
      args.done.add(id);
      patch(id, { status: 'skipped' });
      return true;
    }
  } catch (error) {
    fail(id, describeWriteError(error, `check whether it is necessary to ${STEP_VERB[id]}`));
    return false;
  }
  if (!live()) return false;

  try {
    await args.simulate();
  } catch (error) {
    fail(id, describeWriteError(error, STEP_VERB[id]));
    return false;
  }
  if (!live()) return false;

  patch(id, { status: 'awaiting-signature' });
  let hash: Hex;
  try {
    hash = await args.send();
  } catch (error) {
    fail(id, describeWriteError(error, STEP_VERB[id]));
    return false;
  }

  const receipt = await confirm(id, hash);
  if (!receipt) return false;

  args.done.add(id);
  patch(id, { status: 'confirmed' });
  args.onConfirmed(hash);
  return true;
}
