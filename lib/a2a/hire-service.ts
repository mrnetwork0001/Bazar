/**
 * A2A router service layer.
 *
 * Turns a validated request into an **unsigned ERC-8183 job intent**. It does
 * not quote a price, because no price exists: the ERC-8004 registries publish
 * identity and reputation only. The client chooses the budget when it calls
 * `fund(jobId, expectedBudget)`.
 *
 * Pure pieces (`buildJobIntent`, `intentIdFor`, `explainCalldata`) are exported
 * separately so the developers page can render deterministic examples against a
 * fixed clock, while `processJobIntentRequest` does the full
 * validate -> resolve -> build -> persist pipeline for the route handler.
 */
import { NextResponse } from 'next/server';
import { encodeFunctionData, getAddress, keccak256, stringToHex, toFunctionSelector } from 'viem';
import type { AbiFunction } from 'viem';
import type { A2AErrorResponse, Address, IndexedAgent } from '@/lib/types';
import { APP_URL } from '@/lib/constants';
import { readAgentWallet } from '@/lib/chain/agent-wallet';
import { EVALUATOR_ROUTER_ABI } from '@/lib/abi';
import {
  DEFAULT_CHAIN_ID,
  PAYMENT_TOKEN_EIP712,
  getDeployment,
  type SupportedChainId,
} from '@/lib/chain/addresses';
import { queryAgents, resolveAgentSlug } from '@/lib/agents/repository';
import { SCAN_API_BASE, SUPPORTED_CHAIN_IDS } from '@/lib/indexer/scan-client';
import {
  AGENTIC_COMMERCE_ABI,
  AGENTIC_COMMERCE_EVENT_SIGNATURES,
  AGENTIC_COMMERCE_FUNCTION_SIGNATURES,
  ERC20_ABI,
  NO_OPT_PARAMS,
} from '@/lib/abi';
import {
  PAYMENT_TOKEN_DECIMALS,
  PAYMENT_TOKEN_SYMBOL,
  readKernelInfo,
  readPaymentToken,
} from '@/lib/jobs/read';
import {
  DEFAULT_JOB_DURATION_MS,
  toAgentRef,
  toAgentSlug,
  validateJobIntentRequest,
  type A2ACallStep,
  type A2AJobIntent,
  type A2AJobIntentRequest,
  type A2AJobIntentResponse,
  type A2AKernelState,
  type A2APaymentBlock,
  type A2ATransactionStep,
  type ValidationIssue,
} from './schema';
import { saveIntent } from './store';

/* ------------------------------- constants ----------------------------- */

/** Fixed clock used for deterministic documentation examples. */
export const DOCS_CLOCK = new Date('2026-08-28T12:00:00Z');

export const API_BASE_PATH = '/api/v1/a2a';
export const API_BASE_URL = `${APP_URL}${API_BASE_PATH}`;

/* ------------------------------ pure helpers --------------------------- */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Crockford base32 of a hex string (no padding), truncated to `length` chars. */
function base32FromHex(hex: string, length: number): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    bits += parseInt(clean[i], 16).toString(2).padStart(4, '0');
  }
  let out = '';
  for (let i = 0; i + 5 <= bits.length && out.length < length; i += 5) {
    out += CROCKFORD[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

/**
 * Deterministic intent id: the same (agent, payer, description, expiry) tuple
 * always maps to the same id, so re-posting a body is idempotent and cannot
 * produce two records for one job.
 */
export function intentIdFor(slug: string, payer: string, description: string, expiredAt: number): string {
  const digest = keccak256(stringToHex(`${slug}|${payer.toLowerCase()}|${description}|${expiredAt}`));
  return `job_${base32FromHex(digest, 12)}`;
}

/** Normalizes any 0x address to EIP-55 checksum form (tolerates bad-case input). */
export function normalizeAddress(address: string): Address {
  return getAddress(address.toLowerCase());
}

/**
 * Splits calldata into its 4-byte selector and 32-byte words for display.
 *
 * `createJob` has a dynamic `string description`, so the words after the head
 * are an offset, a length and the UTF-8 payload - not one argument each. The
 * developers page labels them accordingly.
 */
export function explainCalldata(calldata: string): { selector: string; words: string[] } {
  const body = calldata.slice(2);
  const selector = `0x${body.slice(0, 8)}`;
  const words: string[] = [];
  for (let i = 8; i < body.length; i += 64) words.push(`0x${body.slice(i, i + 64)}`);
  return { selector, words };
}

/** Seconds since the epoch - the unit ERC-8183 `expiredAt` is denominated in. */
export function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/* ------------------------------ intent build ---------------------------- */

const FN = {
  ...AGENTIC_COMMERCE_FUNCTION_SIGNATURES,
  /** On the EvaluatorRouter. */
  registerJob: 'registerJob(uint256,address)',
} as const;
const EV = {
  ...AGENTIC_COMMERCE_EVENT_SIGNATURES,
  /** Emitted by the EvaluatorRouter. */
  JobRegistered: 'JobRegistered(uint256,address)',
} as const;

/** ERC-20 `approve(address,uint256)`, from the vendored ERC-20 ABI. */
const APPROVE_SIGNATURE = 'approve(address,uint256)';

/** Pulls one ABI fragment out of a vendored ABI, as a single-entry array. */
function abiFragment(abi: readonly unknown[], name: string): unknown[] {
  const item = abi.find(
    (entry) => (entry as { type?: string; name?: string }).type === 'function' && (entry as { name?: string }).name === name,
  );
  if (!item) throw new Error(`ABI has no function "${name}"`);
  return [item];
}

const CREATE_JOB_ABI = abiFragment(AGENTIC_COMMERCE_ABI, 'createJob');
/** `registerJob` is on the EvaluatorRouter, not the kernel. */
const REGISTER_JOB_ABI = abiFragment(EVALUATOR_ROUTER_ABI, 'registerJob');
const SET_BUDGET_ABI = abiFragment(AGENTIC_COMMERCE_ABI, 'setBudget');
const FUND_ABI = abiFragment(AGENTIC_COMMERCE_ABI, 'fund');
const APPROVE_ABI = abiFragment(ERC20_ABI, 'approve');

function selector(fragment: unknown[]): string {
  return toFunctionSelector(fragment[0] as AbiFunction);
}

/** The ERC-8183 lifecycle, described once and rendered everywhere. */
export function jobLifecycle(): A2ACallStep[] {
  return [
    {
      step: 1,
      signature: FN.createJob,
      actor: 'client',
      description:
        'Submit the calldata in `createJob` to the AgenticCommerce kernel. The jobId it returns is the handle for every later call, and JobCreated carries it indexed by client and provider.',
      emits: EV.JobCreated,
    },
    {
      step: 2,
      signature: FN.setBudget,
      actor: 'client',
      description:
        'Write the budget onto the job. `fund` reverts ZeroBudget() until this lands - the amount is stored on the job, it is not a fund argument. Client-only, and only while the job is OPEN.',
      emits: EV.BudgetSet,
    },
    {
      step: 3,
      signature: `${APPROVE_SIGNATURE} on the payment token`,
      actor: 'client',
      description:
        'Approve the kernel to move at least the budget. `fund` performs an ERC-20 transferFrom, so without an allowance it reverts. This is an ERC-20 call, not a kernel call.',
    },
    {
      step: 4,
      signature: FN.fund,
      actor: 'client',
      description:
        'Move the budget into kernel escrow. `expectedBudget` is an assertion about the stored budget, not the amount to charge - it reverts BudgetMismatch() when the two disagree.',
      emits: EV.JobFunded,
    },
    {
      step: 5,
      signature: FN.submit,
      actor: 'provider',
      description:
        'The provider performs the job and records a deliverable hash against the jobId. Bazar is not in this path.',
      emits: EV.JobSubmitted,
    },
    {
      step: 6,
      signature: FN.complete,
      actor: 'evaluator',
      description:
        'The evaluator accepts the deliverable and the kernel releases the escrowed budget to the provider in the same transaction. `reject` is the mirror path, and the client may also reject a job that is still OPEN to cancel it.',
      emits: `${EV.JobCompleted} + ${EV.PaymentReleased}`,
    },
    {
      step: 7,
      signature: FN.claimRefund,
      actor: 'client',
      description:
        'If the job passes `expiredAt` while the budget is still escrowed, the client reclaims it. The kernel emits Refunded and JobExpired together and the job settles as EXPIRED.',
      emits: `${EV.Refunded} + ${EV.JobExpired}`,
    },
  ];
}

/**
 * The four transactions the client actually sends, in order.
 *
 * Only `createJob` can be fully encoded here: the rest take the jobId the
 * kernel has not issued yet and a budget only the client can choose. Each of
 * those carries its ABI fragment and selector instead, so a caller can encode
 * it without hand-writing a signature - which is exactly the mistake this
 * whole file exists to make unnecessary.
 */
function buildTransactions(
  deployment: ReturnType<typeof getDeployment>,
  createJobCalldata: Address,
  args: { provider: Address; evaluator: Address; expiredAt: number; description: string; hook: Address },
  token: A2APaymentBlock,
): A2ATransactionStep[] {
  const kernel = deployment.agenticCommerce;
  const router = deployment.evaluatorRouter;
  const policy = deployment.optimisticPolicy;
  const unit = token.symbol ? `base units of ${token.symbol}` : 'base units of the payment token';
  const decimalsNote = token.decimals === null
    ? 'Read decimals() on payment.token to convert a human amount - Bazar could not read it while answering this request.'
    : `${token.decimals} decimals, so 1 whole token is 1${'0'.repeat(token.decimals)}.`;

  return [
    {
      step: 1,
      call: 'createJob',
      actor: 'client',
      to: kernel,
      signature: FN.createJob,
      selector: selector(CREATE_JOB_ABI),
      abi: CREATE_JOB_ABI,
      args: [
        { name: 'provider', type: 'address', value: args.provider, source: 'bazar', note: "Owner of the agent's ERC-8004 Identity NFT - the address the kernel pays." },
        { name: 'evaluator', type: 'address', value: args.evaluator, source: 'bazar', note: 'Decides complete vs reject. Cannot be zero.' },
        { name: 'expiredAt', type: 'uint256', value: String(args.expiredAt), source: 'bazar', note: 'Unix seconds. The kernel measures its 300s..365d window from the block that mines this call.' },
        { name: 'description', type: 'string', value: args.description, source: 'caller', note: 'Your brief, written verbatim onchain.' },
        { name: 'hook', type: 'address', value: args.hook, source: 'bazar', note: 'Cannot be zero - a zero hook reverts HookRequired().' },
      ],
      calldata: createJobCalldata,
      ready: true,
      value: '0x0',
      emits: EV.JobCreated,
      description:
        'Creates the job and returns its uint256 id. Send it from `client`; Bazar holds no key and broadcasts nothing.',
      reverts: [
        'HookRequired() - hook is the zero address.',
        'ZeroAddress() - evaluator is the zero address.',
        'ExpiryTooShort() / ExpiryTooLong() - expiredAt outside 300s..365d of block.timestamp.',
        'EnforcedPause() - the kernel is paused.',
      ],
    },
    {
      step: 2,
      call: 'registerJob',
      actor: 'client',
      to: router,
      signature: FN.registerJob,
      selector: selector(REGISTER_JOB_ABI),
      abi: REGISTER_JOB_ABI,
      args: [
        { name: 'jobId', type: 'uint256', value: null, source: 'chain', note: 'The id createJob returned, also carried on the JobCreated event.' },
        { name: 'policy', type: 'address', value: policy, source: 'bazar', note: 'The OptimisticPolicy this deployment settles under.' },
      ],
      calldata: null,
      ready: false,
      value: '0x0',
      emits: EV.JobRegistered,
      description:
        'Binds the job to a settlement policy on the EvaluatorRouter. Easy to miss and not optional: fund() calls the hook, and the router reverts PolicyNotSet() until this has landed.',
      reverts: [
        'RouterNotEvaluator() / RouterNotHook() - the job was created with an evaluator or hook that is not this router.',
        'AlreadyRegistered() - the job already has a policy.',
      ],
    },
    {
      step: 3,
      call: 'setBudget',
      actor: 'client',
      to: kernel,
      signature: FN.setBudget,
      selector: selector(SET_BUDGET_ABI),
      abi: SET_BUDGET_ABI,
      args: [
        { name: 'jobId', type: 'uint256', value: null, source: 'chain', note: 'The id createJob returned, also carried on the JobCreated event.' },
        { name: 'amount', type: 'uint256', value: null, source: 'caller', note: `Your budget, in ${unit}. ${decimalsNote}` },
        { name: 'optParams', type: 'bytes', value: NO_OPT_PARAMS, source: 'bazar', note: 'Empty unless a hook you chose expects extra data.' },
      ],
      calldata: null,
      ready: false,
      value: '0x0',
      emits: EV.BudgetSet,
      description:
        'Writes the budget onto the job. Skipping this is the single most common mistake: fund reverts ZeroBudget() without it. It may be called more than once while the job is OPEN, and re-setting it does not advance the status.',
      reverts: [
        "Unauthorized() - only the job's client may call it.",
        'WrongStatus() - the job is no longer OPEN, or its expiry has already passed.',
      ],
    },
    {
      step: 4,
      call: 'approve',
      actor: 'client',
      to: deployment.paymentToken,
      signature: APPROVE_SIGNATURE,
      selector: selector(APPROVE_ABI),
      abi: APPROVE_ABI,
      args: [
        { name: 'spender', type: 'address', value: kernel, source: 'bazar', note: 'The AgenticCommerce kernel, which pulls the budget in step 4.' },
        { name: 'amount', type: 'uint256', value: null, source: 'caller', note: 'At least the budget from step 2. Real clients on this kernel approve exactly the budget and let fund consume it back to zero.' },
      ],
      calldata: null,
      ready: false,
      value: '0x0',
      description:
        'An ERC-20 call on payment.token, not a kernel call. fund does a transferFrom, so the kernel needs an allowance first.',
      reverts: ["The token's own errors. fund reverts if the allowance or balance is short."],
    },
    {
      step: 5,
      call: 'fund',
      actor: 'client',
      to: kernel,
      signature: FN.fund,
      selector: selector(FUND_ABI),
      abi: FUND_ABI,
      args: [
        { name: 'jobId', type: 'uint256', value: null, source: 'chain', note: 'Same id as step 2.' },
        { name: 'expectedBudget', type: 'uint256', value: null, source: 'caller', note: 'Must equal the amount from step 2. It asserts the stored budget rather than setting it.' },
        { name: 'optParams', type: 'bytes', value: NO_OPT_PARAMS, source: 'bazar' },
      ],
      calldata: null,
      ready: false,
      value: '0x0',
      emits: EV.JobFunded,
      description:
        'Moves the budget into kernel escrow and advances the job to FUNDED. No BNB is sent - value stays 0x0 and the transfer is an ERC-20 pull.',
      reverts: [
        'PolicyNotSet() - registerJob was never called, so the hook has no policy to consult.',
        'ZeroBudget() - step 2 was skipped.',
        'BudgetMismatch() - expectedBudget disagrees with the stored budget.',
        "Unauthorized() - only the job's client may fund it.",
        'WrongStatus() - the job is not OPEN, or expiredAt has already passed.',
      ],
    },
  ];
}

/**
 * Live chain state folded into an intent. Both halves are optional reads: a
 * failed one is reported as unread rather than filled in with a plausible
 * value, and never fails the request.
 */
export interface IntentChainState {
  kernel: { paused: boolean; platformFeeBP: bigint; jobCounter: bigint } | null;
  token: { symbol: string; decimals: number } | null;
  /**
   * The agent's payable wallet, read from this chain's Identity Registry.
   * Null when neither getAgentWallet nor ownerOf answered, which is a refusal
   * to build signable calldata rather than a reason to fall back to the index.
   */
  providerAddress: Address | null;
}

export const NO_CHAIN_STATE: IntentChainState = { kernel: null, token: null, providerAddress: null };

/** Reads the kernel and the payment token for one intent. Never throws. */
export async function readIntentChainState(
  chainId: SupportedChainId,
  tokenId?: string,
): Promise<IntentChainState> {
  const [kernel, token, providerAddress] = await Promise.all([
    readKernelInfo(chainId),
    readPaymentToken(chainId),
    tokenId ? readAgentWallet(chainId, tokenId) : Promise.resolve(null),
  ]);
  return {
    kernel: kernel.ok
      ? { paused: kernel.info.paused, platformFeeBP: kernel.info.platformFeeBP, jobCounter: kernel.info.jobCounter }
      : null,
    token: token.ok ? { symbol: token.token.symbol, decimals: token.token.decimals } : null,
    providerAddress,
  };
}

const KERNEL_READ_NOTE =
  'Read off the kernel while building this intent. platformFeeBP is the skim on a released payment; measured 0 on both chains, so the budget you fund is the budget the provider receives.';
const KERNEL_UNREAD_NOTE =
  'Bazar could not reach the kernel while building this intent, so it cannot tell you whether the kernel is paused or what fee it charges. The calldata below is still correct; check the kernel yourself before broadcasting.';

const PAYMENT_READ_NOTE =
  'symbol and decimals were read off the token while answering this request. Budgets are denominated in this ERC-20, never in BNB, and every transaction below carries value 0x0.';
const PAYMENT_UNREAD_NOTE =
  'Bazar could not read symbol() / decimals() off the payment token while answering this request and will not guess them. Read them yourself before converting a human amount into base units.';

/**
 * Builds the full 201 body.
 *
 * Pure over its inputs: `now` and `chain` are injected, so the developers page
 * can render a byte-identical example and no clock or socket is read here.
 */
export function buildJobIntent(
  request: A2AJobIntentRequest,
  agent: IndexedAgent,
  now: Date,
  chain: IntentChainState = NO_CHAIN_STATE,
): A2AJobIntentResponse {
  /**
   * The settlement chain is the agent's registry chain, never the caller's
   * preference.
   *
   * An ERC-8004 token id resolves to a different wallet on each network -
   * token 1776 is 0x3C005172... on testnet and 0xFC619f08... on mainnet - so
   * honouring a `chainId` that disagrees with the agent would encode signable
   * calldata paying an address the target chain's registry has never vouched
   * for. `buildJobIntent` therefore ignores a conflicting request chain; the
   * caller-facing validation rejects it outright before reaching here.
   */
  const chainId = (agent.chainId ?? DEFAULT_CHAIN_ID) as SupportedChainId;
  const deployment = getDeployment(chainId);

  const expiryDate = request.expiresAt
    ? new Date(request.expiresAt)
    : new Date(now.getTime() + DEFAULT_JOB_DURATION_MS);
  const expiredAt = toUnixSeconds(expiryDate);

  /**
   * The provider is read from the Identity Registry onchain, not from the
   * index. `agent.owner` is an indexer's claim about the chain; escrow pays a
   * real address, so the claim is not good enough. `chain.providerAddress` is
   * resolved by the caller via getAgentWallet() with an ownerOf() fallback on
   * this chain's registry, and is null when neither answered - in which case
   * the intent carries a blocker and no signable calldata.
   */
  const provider = normalizeAddress(chain.providerAddress ?? agent.owner);
  const evaluator = normalizeAddress(request.evaluator ?? deployment.evaluatorRouter);
  // NOT the zero address: `createJob` reverts HookRequired() on a zero hook.
  // The EvaluatorRouter is the hook every real job on both chains carries.
  const hook = normalizeAddress(request.hook ?? deployment.evaluatorRouter);
  const client = normalizeAddress(request.payer);

  const createJobArgs = { provider, evaluator, expiredAt, description: request.description, hook };

  const calldata = encodeFunctionData({
    abi: AGENTIC_COMMERCE_ABI,
    functionName: 'createJob',
    args: [provider, evaluator, BigInt(expiredAt), request.description, hook],
  }) as Address;

  const payment: A2APaymentBlock = {
    token: deployment.paymentToken,
    symbol: chain.token?.symbol ?? null,
    decimals: chain.token?.decimals ?? null,
    readInThisResponse: chain.token !== null,
    eip712: { name: PAYMENT_TOKEN_EIP712.name, version: PAYMENT_TOKEN_EIP712.version },
    quotedAmount: null,
    note: chain.token ? PAYMENT_READ_NOTE : PAYMENT_UNREAD_NOTE,
  };

  const kernel: A2AKernelState = {
    address: deployment.agenticCommerce,
    paused: chain.kernel?.paused ?? null,
    platformFeeBP: chain.kernel ? chain.kernel.platformFeeBP.toString() : null,
    jobCounter: chain.kernel ? chain.kernel.jobCounter.toString() : null,
    readInThisResponse: chain.kernel !== null,
    note: chain.kernel ? KERNEL_READ_NOTE : KERNEL_UNREAD_NOTE,
  };

  const blockers: string[] = [];
  if (chain.kernel?.paused) {
    blockers.push(
      'The AgenticCommerce kernel is paused right now, so createJob would revert EnforcedPause(). The calldata is correct; it cannot be mined until the kernel is unpaused.',
    );
  }

  const intent: A2AJobIntent = {
    id: intentIdFor(agent.slug, client, request.description, expiredAt),
    status: 'unsigned_intent',
    standard: 'ERC-8183',
    createdAt: now.toISOString(),
    chainId,
    chainName: deployment.name,
    contracts: {
      agenticCommerce: deployment.agenticCommerce,
      evaluatorRouter: deployment.evaluatorRouter,
      optimisticPolicy: deployment.optimisticPolicy,
      identityRegistry: deployment.identityRegistry,
    },
    kernel,
    payment,
    createJob: {
      to: deployment.agenticCommerce,
      signature: FN.createJob,
      args: createJobArgs,
      calldata,
      value: '0x0',
    },
    transactions: buildTransactions(deployment, calldata, createJobArgs, payment),
    client,
    lifecycle: jobLifecycle(),
    budget: {
      quoted: false,
      setBy: `${FN.setBudget} then ${FN.fund}`,
      note: 'No price for this agent exists onchain - the ERC-8004 registries publish identity and reputation only. You choose the number, write it with setBudget(jobId, amount, optParams) and lock it with fund(jobId, expectedBudget, optParams). It is denominated in payment.token, never in BNB.',
    },
    agent: toAgentRef(agent),
    blockers,
    readJob: {
      method: 'GET',
      urlTemplate: `${API_BASE_URL}/jobs/{jobId}?chainId=${chainId}`,
      note: 'Once createJob lands, read the job back here. That route is a live getJob(uint256) call against the kernel - it is the same state you would read yourself, not a Bazar record.',
    },
    settlement: {
      observed: false,
      observation: 'read-on-request',
      listener: false,
      note: 'Bazar generated this intent and did not sign, send or observe anything, so `status` stays "unsigned_intent" no matter what you do onchain. It runs no ERC-8183 log listener and keeps no job database. It will read a job for you on request at `readJob.urlTemplate`; nothing is pushed and nothing is watched.',
    },
  };
  if (request.callerAgentId) intent.callerAgentId = request.callerAgentId;

  return { ok: true, intent };
}

/* ------------------------------- pipeline ------------------------------- */

export type ServiceFailure = {
  status: 400 | 404 | 503;
  body: A2AErrorResponse;
};

export type JobIntentResult = { status: 201; body: A2AJobIntentResponse } | ServiceFailure;

export function failure(status: 400 | 404 | 503, code: string, message: string, details?: unknown): ServiceFailure {
  return {
    status,
    body: { ok: false, error: details === undefined ? { code, message } : { code, message, details } },
  };
}

export function validationFailure(errors: ValidationIssue[]): ServiceFailure {
  const message = errors.length === 1 ? errors[0].message : `${errors.length} fields failed validation.`;
  return failure(400, 'VALIDATION_ERROR', message, errors);
}

export const INDEX_UNAVAILABLE_MESSAGE =
  'The ERC-8004 index is unreachable, so Bazar cannot confirm what is listed. It returns no agents rather than a fabricated fallback - retry shortly.';

export function indexUnavailable(detail?: string): ServiceFailure {
  return failure(503, 'INDEX_UNAVAILABLE', INDEX_UNAVAILABLE_MESSAGE, {
    indexer: SCAN_API_BASE,
    ...(detail ? { detail } : {}),
  });
}

/**
 * Resolves an agent reference to an indexed agent, distinguishing the states a
 * single 404 used to collapse:
 *   - the reference is malformed                  -> 400
 *   - it names a chain Bazar does not read        -> 400
 *   - the index is down                           -> 503
 *   - the index answered and nothing matched      -> 404
 *
 * The lookup itself is `resolveAgentSlug` in the repository - the same resolver
 * the /agents/[id] page uses - so the machine endpoint and the human page can
 * never resolve the same slug to different records, or to different scores and
 * ranks for the same record. This handler only maps the resolution onto HTTP.
 */
export async function resolveIndexedAgent(
  ref: string,
  chainId: SupportedChainId = DEFAULT_CHAIN_ID,
): Promise<{ ok: true; agent: IndexedAgent } | ServiceFailure> {
  const slug = toAgentSlug(ref, chainId);
  if (!slug) {
    return failure(
      400,
      'VALIDATION_ERROR',
      'agentId must be "<chainId>-<tokenId>" (e.g. "56-43129"), a bare ERC-8004 tokenId, or the composite id "<chainId>:<registry>:<tokenId>".',
      [{ path: 'agentId', message: `Unrecognised agent reference "${ref}".` }],
    );
  }

  const resolution = await resolveAgentSlug(slug);

  switch (resolution.status) {
    case 'found':
      return { ok: true, agent: resolution.agent };

    case 'unsupported-chain':
      // The index answers for Ethereum, Base and the rest. Bazar is a BNB Chain
      // storefront, so a foreign identity is refused outright rather than
      // resolved and dressed in BscScan links it has no rows behind.
      return failure(
        400,
        'VALIDATION_ERROR',
        `Bazar indexes BNB Chain only. Chain ${resolution.chainId} is not one of ${SUPPORTED_CHAIN_IDS.join(', ')}.`,
        [{ path: 'agentId', message: `Unsupported chain id in "${ref}".` }],
      );

    case 'degraded':
      return indexUnavailable(resolution.error);

    default:
      return failure(
        404,
        'AGENT_NOT_FOUND',
        `No indexed agent resolved for "${ref}". Bazar looks the identity up by token id on both index routes - the per-agent record and the listing - so this means neither has it, which is not proof the identity does not exist onchain.`,
        { agentId: ref, slug },
      );
  }
}

/**
 * Full pipeline for POST /api/v1/a2a/hire:
 * validate body (400) -> resolve agent (400 / 404 / 503) -> read chain state ->
 * build intent (201) + persist.
 *
 * The chain read is deliberately not allowed to fail the request. A caller that
 * wants calldata should get calldata even when a public RPC is having a bad
 * minute; the response marks the unread fields rather than inventing them.
 */
export async function processJobIntentRequest(input: unknown, now: Date = new Date()): Promise<JobIntentResult> {
  const parsed = validateJobIntentRequest(input, now);
  if (!parsed.ok) return validationFailure(parsed.errors);
  const request = parsed.value;

  // The agent is resolved first: the settlement chain and the identity token to
  // look the provider up with are both properties of the agent, not of the
  // request. A caller-supplied chainId that disagrees is rejected outright
  // rather than quietly honoured, because honouring it would encode calldata
  // paying whoever holds the same token id on that other network.
  const discoveryChainId = request.chainId ?? DEFAULT_CHAIN_ID;
  const resolved = await resolveIndexedAgent(request.agentId, discoveryChainId);
  if (!('ok' in resolved)) return resolved;

  const settlementChainId = (resolved.agent.chainId ?? DEFAULT_CHAIN_ID) as SupportedChainId;
  if (request.chainIdExplicit && request.chainId !== settlementChainId) {
    return validationFailure([
      {
        path: 'chainId',
        message:
          `Agent ${resolved.agent.slug} is registered on chain ${settlementChainId}, so it settles there. ` +
          `Chain ${request.chainId} would pay whichever address holds token ${resolved.agent.tokenId} on that network.`,
      },
    ]);
  }

  const chain = await readIntentChainState(settlementChainId, resolved.agent.tokenId);

  const built = buildJobIntent(request, resolved.agent, now, chain);
  saveIntent(built.intent);
  return { status: 201, body: built };
}

/* ------------------------------ agent card ----------------------------- */

/**
 * Bazar's own A2A agent card, served at /.well-known/agent.json.
 *
 * Every address is the verified deployment from `lib/chain/addresses.ts`, and
 * every skill maps to a route that exists today. Nothing aspirational is listed:
 * no MCP transport, no webhooks, no rate limit, no SLA verifier.
 */
export function bazarAgentCard(chainId: SupportedChainId = DEFAULT_CHAIN_ID) {
  const d = getDeployment(chainId);
  return {
    name: 'Bazar Marketplace Router',
    description:
      'Discover ERC-8004 agents on BNB Smart Chain, get an unsigned but immediately executable ERC-8183 job plan for any of them, and read the resulting job back off the AgenticCommerce kernel. Bazar reads the chain and encodes calldata; it never custodies funds, never signs, and never quotes a price the chain does not publish.',
    url: APP_URL,
    version: '0.3.0',
    protocolVersion: '1.0',
    documentationUrl: `${APP_URL}/developers`,
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: [
      {
        id: 'register_agent',
        name: 'Register an agent',
        description:
          'Build an ERC-8004 registration: validates the agent card, embeds it in the tokenURI as a data URI, and returns unsigned register(string) calldata for the owner to submit. Bazar mints nothing and gates nothing - the registry admits anyone.',
        tags: ['registration', 'erc-8004', 'bsc', 'supply-side'],
        endpoint: { method: 'POST', path: `${API_BASE_PATH}/register` },
        examples: ['Prepare a registration for a grid-trading agent that serves A2A and MCP.'],
      },
      {
        id: 'discover_agents',
        name: 'Discover agents',
        description:
          'Search the ERC-8004 Identity Registry index on BSC by text, category, x402 support and onchain reputation.',
        tags: ['discovery', 'erc-8004', 'bsc'],
        endpoint: { method: 'GET', path: `${API_BASE_PATH}/agents` },
        examples: ['Find health-factor agents ranked by reputation that advertise x402.'],
      },
      {
        id: 'read_agent',
        name: 'Read one agent',
        description: 'Fetch a single indexed agent by its "<chainId>-<tokenId>" slug.',
        tags: ['discovery', 'erc-8004'],
        endpoint: { method: 'GET', path: `${API_BASE_PATH}/agents/{id}` },
        examples: ['Read 56-43129.'],
      },
      {
        id: 'job_intent',
        name: 'Build a job plan',
        description:
          'Resolve an agent and return the full ERC-8183 transaction plan: ABI-encoded createJob calldata for the AgenticCommerce kernel, then the setBudget, ERC-20 approve and fund calls with their ABI fragments and selectors. Returns no amount - you choose the budget.',
        tags: ['erc-8183', 'payments', 'escrow'],
        endpoint: { method: 'POST', path: `${API_BASE_PATH}/hire` },
        examples: ['Build a job plan for 56-43129 to monitor a Venus health factor.'],
      },
      {
        id: 'read_job',
        name: 'Read a live job',
        description:
          'Read one ERC-8183 job straight off the AgenticCommerce kernel with getJob(uint256): status, budget in the payment token, evaluator, hook, expiry against the chain head block, and whether a refund is claimable. This is chain state read on request, not a Bazar record. 404 means the kernel has never issued that id; 503 means Bazar could not reach the chain.',
        tags: ['erc-8183', 'escrow', 'onchain-read'],
        endpoint: { method: 'GET', path: `${API_BASE_PATH}/jobs/{id}` },
        examples: ['Read job 56664 on chain 56.'],
      },
      {
        id: 'read_intent',
        name: 'Re-read a job plan',
        description:
          'Return a plan this router previously generated. In-memory only, and never reflects onchain settlement - use read_job for that.',
        tags: ['erc-8183'],
        endpoint: { method: 'GET', path: `${API_BASE_PATH}/hires/{id}` },
        examples: ['Read job_8YFDGXCJ4VP1.'],
      },
    ],
    authentication: { schemes: ['none'] },
    provider: { organization: 'Bazar', url: APP_URL },
    endpoints: { rest: API_BASE_URL },
    chain: { chainId: d.chainId, name: d.name, explorer: d.explorer },
    registries: {
      /** ERC-8004 Identity Registry - the only registry Bazar reads directly. */
      identity: d.identityRegistry,
      /**
       * Reputation is read from the public 8004scan index rather than from a
       * registry address, so no address is claimed for it here.
       */
      reputationSource: SCAN_API_BASE,
    },
    settlement: {
      standard: 'ERC-8183',
      agenticCommerce: d.agenticCommerce,
      evaluatorRouter: d.evaluatorRouter,
      optimisticPolicy: d.optimisticPolicy,
      /**
       * Budgets are denominated in this ERC-20 on both chains, never in BNB.
       * Symbol and decimals are read live on every /hire and /jobs response;
       * the values here are the ones Bazar has verified on both deployments.
       */
      paymentToken: {
        address: d.paymentToken,
        symbol: PAYMENT_TOKEN_SYMBOL,
        decimals: PAYMENT_TOKEN_DECIMALS,
        name: PAYMENT_TOKEN_EIP712.name,
      },
      /** The client sends all four, in this order. Bazar sends none of them. */
      clientTransactions: [FN.createJob, FN.registerJob, FN.setBudget, `${APPROVE_SIGNATURE} on the payment token`, FN.fund],
      custody: 'none',
      pricing: 'not-quoted',
      /** What Bazar actually observes, stated so nothing more is implied. */
      observation: {
        mode: 'read-on-request',
        logListener: false,
        webhooks: false,
        note: 'Bazar reads a job with getJob(uint256) when you ask it to, at GET /api/v1/a2a/jobs/{id}. It runs no background log listener, stores no job history and pushes no notifications. Nothing here is a settlement feed.',
      },
      note: 'Bazar returns unsigned calldata. The client submits createJob, registers the job with the EvaluatorRouter, writes the budget with setBudget, approves the payment token to the kernel and calls fund. Bazar takes no fee and holds no funds; the kernel platform fee is 0 basis points on both deployments.',
    },
  };
}

export type BazarAgentCard = ReturnType<typeof bazarAgentCard>;

/* ------------------------------ http helpers --------------------------- */

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Id',
  'Access-Control-Max-Age': '86400',
};

const BASE_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  'Cache-Control': 'no-store',
};

export function jsonResponse<T>(body: T, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { ...BASE_HEADERS, ...init.headers },
  });
}

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  const body: A2AErrorResponse = {
    ok: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return jsonResponse(body, { status });
}

/** Shared OPTIONS handler for CORS preflight. */
export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
