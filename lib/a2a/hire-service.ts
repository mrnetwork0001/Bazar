/**
 * A2A hire service: turns a validated hire request into an escrow quote.
 *
 * Pure pieces (id derivation, amount math, calldata) are exported separately so
 * the developers page can render deterministic examples at build time, while
 * `processHireRequest` does the full validate -> resolve -> quote -> persist
 * pipeline for the route handler.
 */
import { NextResponse } from 'next/server';
import { encodeFunctionData, getAddress, keccak256, parseUnits, stringToHex, toFunctionSelector } from 'viem';
import type {
  A2AErrorResponse,
  A2AHireRequest,
  A2AHireResponse,
  Address,
  Agent,
  BillingPeriod,
  Currency,
  Hire,
  PricingTier,
} from '@/lib/types';
import {
  APP_URL,
  BAZAR_ESCROW_ADDRESS,
  BSC_CHAIN_ID,
  ERC8004_IDENTITY_REGISTRY,
  ERC8004_REPUTATION_REGISTRY,
  ERC8004_VALIDATION_REGISTRY,
} from '@/lib/constants';
import { getAgent } from '@/lib/data/agents';
import { ESCROW_ABI, ESCROW_FUNCTION_SIGNATURES } from './escrow-abi';
import { validateHireRequest, validateTier, type ValidationIssue } from './schema';
import { saveHire } from './store';

/* ------------------------------- constants ----------------------------- */

/** Protocol fee added on top of the tier price, in basis points (1%). */
export const PROTOCOL_FEE_BPS = 100;
/** How long an escrow quote (and its calldata) stays valid. */
export const QUOTE_TTL_MS = 15 * 60 * 1000;
/** Documented (not yet enforced) unauthenticated rate limit. */
export const RATE_LIMIT_PER_MINUTE = 60;
/** BNB and BEP-20 USDT on BSC both use 18 decimals. */
export const TOKEN_DECIMALS: Record<Currency, number> = { BNB: 18, USDT: 18 };
/** Fixed clock used for deterministic documentation examples. */
export const DOCS_CLOCK = new Date('2026-08-27T12:00:00Z');

const HOUR_MS = 60 * 60 * 1000;
const PERIOD_MS: Record<BillingPeriod, number> = {
  task: 24 * HOUR_MS,
  day: 24 * HOUR_MS,
  week: 7 * 24 * HOUR_MS,
  month: 30 * 24 * HOUR_MS,
};

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
 * Deterministic hire id: the same (agent, tier, payer, task) tuple always maps
 * to the same id, so re-posting a request is idempotent and returns a fresh
 * quote for the same hire.
 */
export function hireIdFor(agentId: string, tierId: string, payer: string, task = ''): string {
  const digest = keccak256(stringToHex(`${agentId}|${tierId}|${payer.toLowerCase()}|${task}`));
  return `hire_${base32FromHex(digest, 12)}`;
}

/** bytes32 representation of a hire id, as used by the escrow contract. */
export function hireIdToBytes32(hireId: string): Address {
  return keccak256(stringToHex(hireId));
}

/** Tier price plus protocol fee, rounded to 6 decimals. */
export function quoteAmount(price: number): number {
  return Math.round(price * (1 + PROTOCOL_FEE_BPS / 10_000) * 1e6) / 1e6;
}

/** Smallest-unit representation (wei-style) of a token amount. */
export function toTokenUnits(amount: number, currency: Currency): bigint {
  return parseUnits(amount.toFixed(6), TOKEN_DECIMALS[currency]);
}

/** Normalizes any 0x address to EIP-55 checksum form (tolerates bad-case input). */
export function normalizeAddress(address: string): Address {
  return getAddress(address.toLowerCase());
}

export const LOCK_ESCROW_SELECTOR = toFunctionSelector(ESCROW_FUNCTION_SIGNATURES.lockEscrow);

export interface EscrowCalldataInput {
  tokenId: number;
  hireId: string;
  payer: Address;
  amount: number;
  currency: Currency;
}

/** ABI-encodes `lockEscrow(agentTokenId, hireId, payer, amount)`. */
export function buildEscrowCalldata(input: EscrowCalldataInput): Address {
  return encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: 'lockEscrow',
    args: [
      BigInt(input.tokenId),
      hireIdToBytes32(input.hireId),
      normalizeAddress(input.payer),
      toTokenUnits(input.amount, input.currency),
    ],
  });
}

/** Splits lockEscrow calldata into its selector and 32-byte words for display. */
export function explainCalldata(calldata: string): { selector: string; words: string[] } {
  const body = calldata.slice(2);
  const selector = `0x${body.slice(0, 8)}`;
  const words: string[] = [];
  for (let i = 8; i < body.length; i += 64) words.push(`0x${body.slice(i, i + 64)}`);
  return { selector, words };
}

/* ------------------------------- quoting ------------------------------- */

/** Builds the full 201 response body without touching the store. */
export function buildHireQuote(request: A2AHireRequest, agent: Agent, tier: PricingTier, now: Date): A2AHireResponse {
  const hireId = hireIdFor(agent.id, tier.id, request.payer, request.task);
  const amount = quoteAmount(tier.price);
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + PERIOD_MS[tier.period]).toISOString();
  const validUntil = new Date(now.getTime() + QUOTE_TTL_MS).toISOString();

  const hire: Hire = {
    id: hireId,
    agentId: agent.id,
    tierId: tier.id,
    hirer: request.payer,
    amount,
    currency: tier.currency,
    status: 'pending',
    slaProgress: 0,
    source: 'a2a',
    createdAt,
    expiresAt,
  };
  if (request.callerAgentId !== undefined) hire.callerAgent = String(request.callerAgentId);
  if (request.task) hire.task = request.task;

  return {
    ok: true,
    hire,
    escrow: {
      contract: BAZAR_ESCROW_ADDRESS,
      chainId: BSC_CHAIN_ID,
      amount,
      currency: tier.currency,
      calldata: buildEscrowCalldata({
        tokenId: agent.tokenId,
        hireId,
        payer: request.payer,
        amount,
        currency: tier.currency,
      }),
      validUntil,
    },
    agent: {
      id: agent.id,
      tokenId: agent.tokenId,
      name: agent.name,
      endpoint: agent.a2a.endpoint,
    },
  };
}

export type HireServiceResult =
  | { status: 201; body: A2AHireResponse }
  | { status: 400 | 403 | 404; body: A2AErrorResponse };

function failure(status: 400 | 403 | 404, code: string, message: string, details?: unknown): HireServiceResult {
  return { status, body: { ok: false, error: details === undefined ? { code, message } : { code, message, details } } };
}

function validationFailure(errors: ValidationIssue[]): HireServiceResult {
  const message = errors.length === 1 ? errors[0].message : `${errors.length} fields failed validation.`;
  return failure(400, 'VALIDATION_ERROR', message, errors);
}

/**
 * Full pipeline for POST /api/v1/a2a/hire:
 * validate body -> resolve agent (404) -> A2A enabled? (403) -> tier/currency (400)
 * -> deadline sanity (400) -> quote (201) + persist as `pending`.
 */
export function processHireRequest(input: unknown, now: Date = new Date()): HireServiceResult {
  const parsed = validateHireRequest(input);
  if (!parsed.ok) return validationFailure(parsed.errors);
  const request = parsed.value;

  const agent = getAgent(request.agentId);
  if (!agent) {
    return failure(404, 'AGENT_NOT_FOUND', `No ERC-8004 agent matches "${request.agentId}" on Bazar.`, { agentId: request.agentId });
  }
  if (!agent.a2a.enabled) {
    return failure(403, 'A2A_DISABLED', `${agent.name} does not accept programmatic (A2A) hires.`, { agentId: agent.id });
  }

  const tierCheck = validateTier(request, agent);
  if (!tierCheck.ok) return validationFailure(tierCheck.errors);

  if (request.sla?.deadline && Date.parse(request.sla.deadline) <= now.getTime()) {
    return validationFailure([{ path: 'sla.deadline', message: 'sla.deadline must be in the future.' }]);
  }

  const quote = buildHireQuote(request, agent, tierCheck.value, now);
  saveHire(quote.hire);
  return { status: 201, body: quote };
}

/* ------------------------------ agent card ----------------------------- */

/** Bazar's own A2A agent card, served at /.well-known/agent.json. */
export function bazarAgentCard() {
  return {
    name: 'Bazar Marketplace Router',
    description:
      'Discover, hire and pay ERC-8004 AI agents on BNB Smart Chain through one endpoint. Quotes return escrow calldata; payouts auto-release on SLA verification.',
    url: APP_URL,
    version: '0.1.0',
    protocolVersion: '1.0',
    documentationUrl: `${APP_URL}/developers`,
    capabilities: { streaming: false, pushNotifications: true },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: [
      {
        id: 'discover_agents',
        name: 'Discover agents',
        description: 'Search and filter indexed ERC-8004 agents by category, protocol, SLA score and A2A capability.',
        tags: ['discovery', 'erc-8004', 'bsc'],
        endpoint: { method: 'GET', path: `${API_BASE_PATH}/agents` },
        examples: ['Find health-factor monitors with SLA above 98 that accept A2A hires.'],
      },
      {
        id: 'hire_agent',
        name: 'Hire agent',
        description: 'Request an escrow quote for a pricing tier. Returns hire id, amount including protocol fee and signed-ready calldata.',
        tags: ['hire', 'escrow', 'payments'],
        endpoint: { method: 'POST', path: `${API_BASE_PATH}/hire` },
        examples: ['Hire whalewatch-bsc on the task tier and watch 50 whale wallets.'],
      },
      {
        id: 'hire_status',
        name: 'Hire status',
        description: 'Track a hire through pending, escrowed, active, sla-check, released or refunded.',
        tags: ['status', 'escrow'],
        endpoint: { method: 'GET', path: `${API_BASE_PATH}/hires/{id}` },
        examples: ['What is the status of hire_01J8Z4Q1T6VF?'],
      },
    ],
    authentication: { schemes: ['none'] },
    provider: { organization: 'Bazar', url: APP_URL },
    endpoints: {
      rest: API_BASE_URL,
      mcp: `${API_BASE_URL}/mcp (planned)`,
    },
    registries: {
      identity: ERC8004_IDENTITY_REGISTRY,
      reputation: ERC8004_REPUTATION_REGISTRY,
      validation: ERC8004_VALIDATION_REGISTRY,
      chainId: BSC_CHAIN_ID,
    },
    escrow: { contract: BAZAR_ESCROW_ADDRESS, chainId: BSC_CHAIN_ID, protocolFeeBps: PROTOCOL_FEE_BPS },
    rateLimit: { unauthenticated: `${RATE_LIMIT_PER_MINUTE} requests/minute` },
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
  'X-RateLimit-Limit': String(RATE_LIMIT_PER_MINUTE),
  'X-RateLimit-Policy': `${RATE_LIMIT_PER_MINUTE};w=60`,
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
