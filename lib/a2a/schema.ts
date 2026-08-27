/**
 * Hand-rolled validation for the A2A router (no runtime schema deps).
 *
 * `validateHireRequest` checks the shape of an incoming body and narrows it to
 * `A2AHireRequest`. `validateTier` checks the request against a resolved agent
 * (tier exists, currency matches). Both return a discriminated result so route
 * handlers can map failures straight to a 400 with structured `details`.
 */
import type { A2AHireRequest, Address, Agent, Currency, PricingTier } from '@/lib/types';
import { isAddress } from '@/lib/utils';
import { DEMO_HIRER } from '@/lib/data/hires';

export interface ValidationIssue {
  /** JSON path of the offending field, e.g. "sla.maxLatencyMs". Empty for body-level errors. */
  path: string;
  message: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationIssue[] };

export const CURRENCIES: readonly Currency[] = ['BNB', 'USDT'];
export const MAX_TASK_LENGTH = 2000;
export const MAX_LATENCY_MS = 600_000;

/* ------------------------------- guards -------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Bazar slug ("whalewatch-bsc") or ERC-8004 tokenId (8841 / "8841"). */
function isAgentRef(value: unknown): value is string | number {
  if (isNonEmptyString(value)) return true;
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

/* ------------------------------ validators ----------------------------- */

export function validateHireRequest(input: unknown): ValidationResult<A2AHireRequest> {
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '', message: 'Body must be a JSON object.' }] };
  }

  const errors: ValidationIssue[] = [];
  const { agentId, tierId, payer, currency, task, callerAgentId, sla, callbackUrl } = input;

  if (agentId === undefined) {
    errors.push({ path: 'agentId', message: 'agentId is required (Bazar slug or ERC-8004 tokenId).' });
  } else if (!isAgentRef(agentId)) {
    errors.push({ path: 'agentId', message: 'agentId must be a non-empty slug string or a positive integer tokenId.' });
  }

  if (!isNonEmptyString(tierId)) {
    errors.push({ path: 'tierId', message: 'tierId is required, e.g. "task", "weekly" or "monthly".' });
  }

  if (!isAddress(payer)) {
    errors.push({ path: 'payer', message: 'payer must be a 0x-prefixed 20-byte EVM address.' });
  }

  if (currency !== undefined && !CURRENCIES.includes(currency as Currency)) {
    errors.push({ path: 'currency', message: 'currency must be "BNB" or "USDT".' });
  }

  if (task !== undefined) {
    if (typeof task !== 'string') {
      errors.push({ path: 'task', message: 'task must be a string.' });
    } else if (task.length > MAX_TASK_LENGTH) {
      errors.push({ path: 'task', message: `task must be at most ${MAX_TASK_LENGTH} characters.` });
    }
  }

  if (callerAgentId !== undefined && !isAgentRef(callerAgentId)) {
    errors.push({ path: 'callerAgentId', message: 'callerAgentId must be a slug string or a positive integer tokenId.' });
  }

  if (sla !== undefined) {
    if (!isRecord(sla)) {
      errors.push({ path: 'sla', message: 'sla must be an object.' });
    } else {
      const { maxLatencyMs, minUptime, deadline } = sla;
      if (maxLatencyMs !== undefined) {
        if (typeof maxLatencyMs !== 'number' || !Number.isInteger(maxLatencyMs) || maxLatencyMs < 1 || maxLatencyMs > MAX_LATENCY_MS) {
          errors.push({ path: 'sla.maxLatencyMs', message: `sla.maxLatencyMs must be an integer between 1 and ${MAX_LATENCY_MS}.` });
        }
      }
      if (minUptime !== undefined) {
        if (typeof minUptime !== 'number' || !Number.isFinite(minUptime) || minUptime < 0 || minUptime > 100) {
          errors.push({ path: 'sla.minUptime', message: 'sla.minUptime must be a number between 0 and 100.' });
        }
      }
      if (deadline !== undefined) {
        if (typeof deadline !== 'string' || !isIsoDate(deadline)) {
          errors.push({ path: 'sla.deadline', message: 'sla.deadline must be an ISO-8601 timestamp.' });
        }
      }
    }
  }

  if (callbackUrl !== undefined) {
    if (typeof callbackUrl !== 'string' || !isHttpUrl(callbackUrl)) {
      errors.push({ path: 'callbackUrl', message: 'callbackUrl must be an absolute http(s) URL.' });
    }
  }

  if (errors.length) return { ok: false, errors };

  const value: A2AHireRequest = {
    agentId: agentId as string | number,
    tierId: (tierId as string).trim(),
    payer: payer as Address,
  };
  if (currency !== undefined) value.currency = currency as Currency;
  if (typeof task === 'string' && task.trim()) value.task = task.trim();
  if (callerAgentId !== undefined) value.callerAgentId = callerAgentId as string | number;
  if (isRecord(sla)) {
    const clean: NonNullable<A2AHireRequest['sla']> = {};
    if (typeof sla.maxLatencyMs === 'number') clean.maxLatencyMs = sla.maxLatencyMs;
    if (typeof sla.minUptime === 'number') clean.minUptime = sla.minUptime;
    if (typeof sla.deadline === 'string') clean.deadline = sla.deadline;
    value.sla = clean;
  }
  if (typeof callbackUrl === 'string') value.callbackUrl = callbackUrl;

  return { ok: true, value };
}

/** Second pass once the agent is resolved: tier must exist and currency must match. */
export function validateTier(request: A2AHireRequest, agent: Agent): ValidationResult<PricingTier> {
  const tier = agent.pricing.find((t) => t.id === request.tierId);
  if (!tier) {
    return {
      ok: false,
      errors: [
        {
          path: 'tierId',
          message: `Unknown tier "${request.tierId}" for ${agent.name}. Available tiers: ${agent.pricing.map((t) => t.id).join(', ')}.`,
        },
      ],
    };
  }
  if (request.currency && request.currency !== tier.currency) {
    return {
      ok: false,
      errors: [
        {
          path: 'currency',
          message: `Tier "${tier.id}" on ${agent.name} is priced in ${tier.currency}; got ${request.currency}. Omit currency or send "${tier.currency}".`,
        },
      ],
    };
  }
  return { ok: true, value: tier };
}

/* ------------------------------ projections ---------------------------- */

/** Agent as returned by the list endpoint: everything except the sparkline series. */
export type A2AAgentSummary = Omit<Agent, 'sparkline'>;

export function toAgentSummary(agent: Agent): A2AAgentSummary {
  const { sparkline, ...rest } = agent;
  void sparkline;
  return rest;
}

/* ------------------------------ docs helpers --------------------------- */

export interface FieldDoc {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

/** Field reference for the POST /hire body, rendered by the developers page. */
export const HIRE_REQUEST_FIELDS: FieldDoc[] = [
  { name: 'agentId', type: 'string | number', required: true, description: 'Bazar slug (e.g. "whalewatch-bsc") or ERC-8004 Identity NFT tokenId (e.g. 8841).' },
  { name: 'tierId', type: 'string', required: true, description: 'One of the agent\'s pricing tier ids: "task", "weekly" or "monthly".' },
  { name: 'payer', type: 'address', required: true, description: 'Wallet that will lock escrow — usually the calling agent\'s Altana or EOA address.' },
  { name: 'currency', type: '"BNB" | "USDT"', description: 'Optional. Must match the tier currency when provided.' },
  { name: 'task', type: 'string', description: `Optional instruction forwarded to the hired agent (max ${MAX_TASK_LENGTH} chars).` },
  { name: 'callerAgentId', type: 'string | number', description: 'Optional ERC-8004 identity of the calling agent for reputation attribution.' },
  { name: 'sla.maxLatencyMs', type: 'integer', description: `Optional latency ceiling, 1 – ${MAX_LATENCY_MS} ms. Verified against on-chain telemetry.` },
  { name: 'sla.minUptime', type: 'number', description: 'Optional uptime floor in percent (0 – 100).' },
  { name: 'sla.deadline', type: 'ISO-8601', description: 'Optional hard deadline. Must be in the future at quote time.' },
  { name: 'callbackUrl', type: 'https URL', description: 'Optional webhook notified on EscrowLocked, SLA verdict and release/refund.' },
];

/** Canonical example body used across docs, quickstart snippets and the live console. */
export const SAMPLE_HIRE_REQUEST: A2AHireRequest = {
  agentId: 'whalewatch-bsc',
  tierId: 'task',
  payer: DEMO_HIRER,
  currency: 'BNB',
  task: 'Watch the top 50 BNB whale wallets and call back on any transfer above 500 BNB.',
  callerAgentId: 'yieldrouter',
  sla: { maxLatencyMs: 800, minUptime: 99.5 },
  callbackUrl: 'https://agents.bazar.bnb/yieldrouter/callbacks/bazar',
};
