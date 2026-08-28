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
import { encodeFunctionData, getAddress, keccak256, stringToHex } from 'viem';
import type { A2AErrorResponse, Address, IndexedAgent } from '@/lib/types';
import { APP_URL } from '@/lib/constants';
import {
  DEFAULT_CHAIN_ID,
  PAYMENT_TOKEN_EIP712,
  getDeployment,
  type SupportedChainId,
} from '@/lib/chain/addresses';
import { queryAgents, resolveAgentSlug } from '@/lib/agents/repository';
import { SCAN_API_BASE, SUPPORTED_CHAIN_IDS } from '@/lib/indexer/scan-client';
import { ERC8183_ABI, ERC8183_EVENT_SIGNATURES, ERC8183_FUNCTION_SIGNATURES, NO_HOOK } from './erc8183-abi';
import {
  DEFAULT_JOB_DURATION_MS,
  toAgentRef,
  toAgentSlug,
  validateJobIntentRequest,
  type A2ACallStep,
  type A2AJobIntent,
  type A2AJobIntentRequest,
  type A2AJobIntentResponse,
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

/** The ERC-8183 lifecycle, described once and rendered everywhere. */
export function jobLifecycle(): A2ACallStep[] {
  return [
    {
      step: 1,
      signature: ERC8183_FUNCTION_SIGNATURES.createJob,
      actor: 'client',
      description:
        'Submit the calldata in `createJob` to the AgenticCommerce kernel. The returned jobId is the handle for every later call.',
      emits: ERC8183_EVENT_SIGNATURES.JobCreated,
    },
    {
      step: 2,
      signature: ERC8183_FUNCTION_SIGNATURES.fund,
      actor: 'client',
      description:
        'Approve the payment token to the kernel, then fund the job with the budget you are willing to pay. Bazar does not choose this number.',
      emits: ERC8183_EVENT_SIGNATURES.JobFunded,
    },
    {
      step: 3,
      signature: '(offchain work, then the provider submits a deliverable)',
      actor: 'provider',
      description:
        'The provider performs the job and records a deliverable hash against the jobId. Bazar is not in this path.',
      emits: ERC8183_EVENT_SIGNATURES.JobSubmitted,
    },
    {
      step: 4,
      signature: ERC8183_FUNCTION_SIGNATURES.complete,
      actor: 'evaluator',
      description:
        'The evaluator accepts the deliverable and the kernel releases the escrowed budget to the provider. `reject` is the mirror path.',
      emits: `${ERC8183_EVENT_SIGNATURES.JobCompleted} + ${ERC8183_EVENT_SIGNATURES.PaymentReleased}`,
    },
    {
      step: 5,
      signature: ERC8183_FUNCTION_SIGNATURES.claimRefund,
      actor: 'client',
      description: 'If the job passes `expiredAt` without completing, the client reclaims the funded budget.',
    },
  ];
}

/**
 * Builds the full 201 body. Pure: no store write, no network, no clock read -
 * `now` is injected so the docs page can render a byte-identical example.
 */
export function buildJobIntent(
  request: A2AJobIntentRequest,
  agent: IndexedAgent,
  now: Date,
): A2AJobIntentResponse {
  const chainId = (request.chainId ?? agent.chainId ?? DEFAULT_CHAIN_ID) as SupportedChainId;
  const deployment = getDeployment(chainId);

  const expiryDate = request.expiresAt
    ? new Date(request.expiresAt)
    : new Date(now.getTime() + DEFAULT_JOB_DURATION_MS);
  const expiredAt = toUnixSeconds(expiryDate);

  // The ERC-8004 Identity Registry publishes the owner of the identity NFT and
  // nothing else that can receive payment, so the owner is the provider.
  const provider = normalizeAddress(agent.owner);
  const evaluator = normalizeAddress(request.evaluator ?? deployment.evaluatorRouter);
  const hook = normalizeAddress(request.hook ?? NO_HOOK);
  const client = normalizeAddress(request.payer);

  const calldata = encodeFunctionData({
    abi: ERC8183_ABI,
    functionName: 'createJob',
    args: [provider, evaluator, BigInt(expiredAt), request.description, hook],
  }) as Address;

  const intent: A2AJobIntent = {
    id: intentIdFor(agent.slug, client, request.description, expiredAt),
    status: 'unsigned_intent',
    standard: 'ERC-8183',
    createdAt: now.toISOString(),
    chainId,
    contracts: {
      agenticCommerce: deployment.agenticCommerce,
      evaluatorRouter: deployment.evaluatorRouter,
      optimisticPolicy: deployment.optimisticPolicy,
      identityRegistry: deployment.identityRegistry,
    },
    payment: {
      token: deployment.paymentToken,
      eip712: { name: PAYMENT_TOKEN_EIP712.name, version: PAYMENT_TOKEN_EIP712.version },
      quotedAmount: null,
    },
    createJob: {
      to: deployment.agenticCommerce,
      signature: ERC8183_FUNCTION_SIGNATURES.createJob,
      args: { provider, evaluator, expiredAt, description: request.description, hook },
      calldata,
      value: '0x0',
    },
    client,
    lifecycle: jobLifecycle(),
    budget: {
      quoted: false,
      setBy: ERC8183_FUNCTION_SIGNATURES.fund,
      note: 'No price for this agent exists on chain - the ERC-8004 registries publish identity and reputation only. You set the budget yourself in fund(jobId, expectedBudget, optParams), denominated in payment.token.',
    },
    agent: toAgentRef(agent),
    settlement: {
      observed: false,
      note: 'Bazar generated this intent and did not sign, send or observe anything. It runs no ERC-8183 log listener, so status stays "unsigned_intent" even after you settle the job on chain. Read authoritative state with getJob(jobId) on the kernel.',
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
 * validate body (400) -> resolve agent (400 / 404 / 503) -> build intent (201) + persist.
 */
export async function processJobIntentRequest(input: unknown, now: Date = new Date()): Promise<JobIntentResult> {
  const parsed = validateJobIntentRequest(input, now);
  if (!parsed.ok) return validationFailure(parsed.errors);
  const request = parsed.value;

  const resolved = await resolveIndexedAgent(request.agentId, request.chainId ?? DEFAULT_CHAIN_ID);
  if (!('ok' in resolved)) return resolved;

  const built = buildJobIntent(request, resolved.agent, now);
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
      'Discover ERC-8004 agents on BNB Smart Chain and get an unsigned ERC-8183 job intent for any of them. Bazar reads the registries and encodes calldata; it never custodies funds, never signs, and never quotes a price the chain does not publish.',
    url: APP_URL,
    version: '0.2.0',
    protocolVersion: '1.0',
    documentationUrl: `${APP_URL}/developers`,
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: [
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
        name: 'Build a job intent',
        description:
          'Resolve an agent and return unsigned ERC-8183 createJob calldata addressed to the AgenticCommerce kernel. Returns no amount - the client sets the budget in fund().',
        tags: ['erc-8183', 'payments', 'escrow'],
        endpoint: { method: 'POST', path: `${API_BASE_PATH}/hire` },
        examples: ['Build a job intent for 56-43129 to monitor a Venus health factor.'],
      },
      {
        id: 'read_intent',
        name: 'Re-read an intent',
        description:
          'Return an intent this router previously generated. In-memory only, and never reflects onchain settlement.',
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
      paymentToken: d.paymentToken,
      custody: 'none',
      pricing: 'not-quoted',
      note: 'Bazar returns unsigned createJob calldata. The client submits it, sets the budget with fund(jobId, expectedBudget) and settles with the evaluator. Bazar takes no fee and holds no funds.',
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
