/**
 * Wire contract for the A2A router (no runtime schema deps).
 *
 * Two things live here:
 *   1. `validateJobIntentRequest` - narrows an unknown POST body to a
 *      `A2AJobIntentRequest` with structured, per-field errors.
 *   2. The public projections - what an external agent actually sees.
 *
 * The projection is deliberately the identity function over `IndexedAgent`.
 * Bazar's storefront and its API read the same repository, and the API adds no
 * field the ERC-8004 registries do not publish: no price, no ROI, no SLA score,
 * no uptime. If a number is not in `IndexedAgent`, it is not on chain, and the
 * router does not invent one.
 */
import type { Address, CategoryId, IndexedAgent } from '@/lib/types';
import type { SortKey } from '@/lib/agents/repository';
import { isAddress } from '@/lib/utils';
import {
  BSC_MAINNET,
  BSC_TESTNET,
  DEFAULT_CHAIN_ID,
  getDeployment,
  type SupportedChainId,
} from '@/lib/chain/addresses';
import { parseAgentId } from '@/lib/indexer/scan-client';

export interface ValidationIssue {
  /** JSON path of the offending field, e.g. "expiresAt". Empty for body-level errors. */
  path: string;
  message: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationIssue[] };

export const MAX_DESCRIPTION_LENGTH = 2000;
/** An ERC-8183 job must expire in the future and within a year of creation. */
export const MAX_JOB_DURATION_MS = 365 * 24 * 60 * 60 * 1000;
/** Applied when the caller sends no `expiresAt`. */
export const DEFAULT_JOB_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export const SUPPORTED_CHAIN_IDS: readonly SupportedChainId[] = [BSC_MAINNET, BSC_TESTNET];

/* ------------------------------ request type ---------------------------- */

/**
 * Body of `POST /api/v1/a2a/hire`.
 *
 * There is no `tierId`, `currency` or `sla` block any more: the ERC-8004
 * registries publish no prices and no service levels, so the router cannot
 * validate against them. Budget is set by the client in `fund(jobId, budget)`.
 */
export interface A2AJobIntentRequest {
  /** "56-43129", a bare tokenId, or the composite "56:0x8004…:43129". */
  agentId: string;
  /** Wallet that will submit `createJob` and `fund` - the ERC-8183 client. */
  payer: Address;
  /** Job brief; written verbatim into the onchain `description` argument. */
  description: string;
  /** ISO-8601 job expiry. Defaults to 7 days out. Becomes `expiredAt` (unix seconds). */
  expiresAt?: string;
  /** Overrides the deployment's EvaluatorRouter. */
  evaluator?: Address;
  /** ERC-8183 hook contract. Defaults to the zero address (no hook). */
  hook?: Address;
  /** 56 (default) or 97. */
  chainId?: SupportedChainId;
  /** Optional ERC-8004 identity of the calling agent, recorded on the intent. */
  callerAgentId?: string;
}

/* ------------------------------- guards -------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

/**
 * Normalises the three accepted agent references onto the repository's slug
 * form, `"<chainId>-<tokenId>"`. Returns null when the reference is not one of
 * them - an unresolvable *shape* is a 400, a resolvable shape that no agent
 * matches is a 404.
 */
export function toAgentSlug(ref: string, chainId: SupportedChainId = DEFAULT_CHAIN_ID): string | null {
  const raw = ref.trim();
  if (/^\d+-\d+$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `${chainId}-${raw}`;
  const composite = parseAgentId(raw);
  if (composite) return `${composite.chainId}-${composite.tokenId}`;
  return null;
}

/* ------------------------------ validator ------------------------------- */

export function validateJobIntentRequest(
  input: unknown,
  now: Date = new Date(),
): ValidationResult<A2AJobIntentRequest> {
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '', message: 'Body must be a JSON object.' }] };
  }

  const errors: ValidationIssue[] = [];
  const { agentId, payer, description, expiresAt, evaluator, hook, chainId, callerAgentId } = input;

  let resolvedChainId: SupportedChainId = DEFAULT_CHAIN_ID;
  if (chainId !== undefined) {
    if (!SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId)) {
      errors.push({
        path: 'chainId',
        message: `chainId must be ${BSC_MAINNET} (BNB Smart Chain) or ${BSC_TESTNET} (BSC Testnet).`,
      });
    } else {
      resolvedChainId = chainId as SupportedChainId;
    }
  }

  const agentRef = typeof agentId === 'number' ? String(agentId) : agentId;
  if (agentRef === undefined) {
    errors.push({
      path: 'agentId',
      message: 'agentId is required - the Bazar slug "<chainId>-<tokenId>", e.g. "56-43129".',
    });
  } else if (!isNonEmptyString(agentRef)) {
    errors.push({ path: 'agentId', message: 'agentId must be a non-empty string.' });
  } else if (!toAgentSlug(agentRef, resolvedChainId)) {
    errors.push({
      path: 'agentId',
      message:
        'agentId must be "<chainId>-<tokenId>" (e.g. "56-43129"), a bare ERC-8004 tokenId, or the composite id "<chainId>:<registry>:<tokenId>".',
    });
  }

  if (!isAddress(payer)) {
    errors.push({
      path: 'payer',
      message: 'payer must be a 0x-prefixed 20-byte EVM address - the wallet that will call createJob and fund.',
    });
  }

  if (!isNonEmptyString(description)) {
    errors.push({
      path: 'description',
      message: 'description is required - it is written verbatim into the onchain createJob description argument.',
    });
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push({
      path: 'description',
      message: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
    });
  }

  if (expiresAt !== undefined) {
    if (typeof expiresAt !== 'string' || !isIsoDate(expiresAt)) {
      errors.push({ path: 'expiresAt', message: 'expiresAt must be an ISO-8601 timestamp.' });
    } else {
      const ms = Date.parse(expiresAt);
      if (ms <= now.getTime()) {
        errors.push({ path: 'expiresAt', message: 'expiresAt must be in the future.' });
      } else if (ms - now.getTime() > MAX_JOB_DURATION_MS) {
        errors.push({ path: 'expiresAt', message: 'expiresAt must be within 365 days of now.' });
      }
    }
  }

  if (evaluator !== undefined && !isAddress(evaluator)) {
    errors.push({
      path: 'evaluator',
      message: 'evaluator must be a 0x-prefixed EVM address. Omit it to use the deployment EvaluatorRouter.',
    });
  }

  if (hook !== undefined && !isAddress(hook)) {
    errors.push({ path: 'hook', message: 'hook must be a 0x-prefixed EVM address, or omitted for no hook.' });
  }

  const caller = typeof callerAgentId === 'number' ? String(callerAgentId) : callerAgentId;
  if (caller !== undefined && !isNonEmptyString(caller)) {
    errors.push({ path: 'callerAgentId', message: 'callerAgentId must be a non-empty string when present.' });
  }

  if (errors.length) return { ok: false, errors };

  const value: A2AJobIntentRequest = {
    agentId: (agentRef as string).trim(),
    payer: payer as Address,
    description: (description as string).trim(),
    chainId: resolvedChainId,
  };
  if (typeof expiresAt === 'string') value.expiresAt = expiresAt;
  if (evaluator !== undefined) value.evaluator = evaluator as Address;
  if (hook !== undefined) value.hook = hook as Address;
  if (isNonEmptyString(caller)) value.callerAgentId = caller.trim();

  return { ok: true, value };
}

/* ------------------------------ projections ---------------------------- */

/** Bazar's own derivations, kept out of the registry fields they sit beside. */
export interface A2ABazarDerived {
  category: CategoryId;
  /** Why the classifier filed the agent here, in words. */
  categoryReason: string;
  /** Which classifier produced it, so a caller can pin behaviour. */
  classifier: 'keyword-v1';
  /**
   * True when nothing in the agent's registration matched a category term and
   * the bucket was assigned by hash for balanced coverage. A caller filtering
   * on `category` needs this to know the placement is Bazar's arithmetic and
   * not the agent's claim.
   */
  categoryInferred: boolean;
}

/**
 * What `GET /agents` and `GET /agents/{id}` return per agent.
 *
 * Every top-level field is an ERC-8004 registry value as the public index
 * publishes it - the same record the human storefront renders, so the two
 * layers cannot disagree about what is listed. The two things Bazar makes up
 * are quarantined: the cosmetic avatar gradient is dropped entirely (it is a
 * rendering detail, meaningless to a machine caller) and the category is nested
 * under `bazar`, because ERC-8004 has no category field and presenting Bazar's
 * classification flat alongside `owner` and `tokenId` implied the registry
 * published it.
 */
export type A2AAgentSummary = Omit<
  IndexedAgent,
  'avatar' | 'category' | 'categoryConfidence' | 'categoryReason'
> & {
  bazar: A2ABazarDerived;
};

/** Explicit seam between the repository record and the public API record. */
export function toAgentSummary(agent: IndexedAgent): A2AAgentSummary {
  return {
    slug: agent.slug,
    agentId: agent.agentId,
    tokenId: agent.tokenId,
    chainId: agent.chainId,
    registry: agent.registry,
    owner: agent.owner,
    ownerLabel: agent.ownerLabel,
    name: agent.name,
    description: agent.description,
    imageUrl: agent.imageUrl,
    verified: agent.verified,
    protocols: agent.protocols,
    x402: agent.x402,
    reputation: agent.reputation,
    registeredAt: agent.registeredAt,
    updatedAt: agent.updatedAt,
    bazar: {
      category: agent.category,
      categoryReason: agent.categoryReason,
      classifier: 'keyword-v1',
      categoryInferred: agent.categoryConfidence === 'unclassified',
    },
  };
}

/** Echo of the resolved query, so a caller can see what the router actually ran. */
export interface A2AAgentsQueryEcho {
  category: CategoryId | 'all';
  search: string | null;
  sort: SortKey;
  chainId: number;
}

export interface A2AAgentsResponse {
  ok: true;
  data: A2AAgentSummary[];
  total: number;
  limit: number;
  offset: number;
  query: A2AAgentsQueryEcho;
  /**
   * `total` is the index-wide match count from 8004scan, counted before Bazar
   * applies its local category classification, so a category-filtered page can
   * carry fewer than `limit` agents while `total` is still large.
   */
  totalIsPreCategoryFilter: boolean;
}

/**
 * Single builder for the list envelope, used by the route handler and by the
 * documentation examples, so the published shape cannot drift from the shipped one.
 */
export function buildAgentsResponse(
  agents: IndexedAgent[],
  meta: { total: number; limit: number; offset: number } & A2AAgentsQueryEcho,
): A2AAgentsResponse {
  return {
    ok: true,
    data: agents.map(toAgentSummary),
    total: meta.total,
    limit: meta.limit,
    offset: meta.offset,
    query: { category: meta.category, search: meta.search, sort: meta.sort, chainId: meta.chainId },
    totalIsPreCategoryFilter: meta.category !== 'all',
  };
}

/** Compact agent reference embedded in a job intent. */
export interface A2AAgentRef {
  slug: string;
  agentId: string;
  tokenId: string;
  chainId: number;
  name: string;
  /** Identity Registry the agent is registered in. */
  registry: Address;
  /** Owner of the Identity NFT - the address used as the ERC-8183 `provider`. */
  owner: Address;
  ownerLabel: string | null;
  protocols: string[];
  x402: boolean;
  reputation: IndexedAgent['reputation'];
}

export function toAgentRef(agent: IndexedAgent): A2AAgentRef {
  return {
    slug: agent.slug,
    agentId: agent.agentId,
    tokenId: agent.tokenId,
    chainId: agent.chainId,
    name: agent.name,
    registry: agent.registry,
    owner: agent.owner,
    ownerLabel: agent.ownerLabel,
    protocols: agent.protocols,
    x402: agent.x402,
    reputation: agent.reputation,
  };
}

/* ------------------------------ intent types --------------------------- */

/** One unsigned transaction the caller is expected to submit. */
export interface A2ACallStep {
  step: number;
  /** Solidity signature of the call. */
  signature: string;
  /** Who submits it. */
  actor: 'client' | 'provider' | 'evaluator';
  description: string;
  /** Event emitted on success, when the kernel emits one. */
  emits?: string;
}

export interface A2AJobIntent {
  id: string;
  /** Always "unsigned_intent": nothing has been signed, sent or settled. */
  status: 'unsigned_intent';
  standard: 'ERC-8183';
  createdAt: string;
  chainId: number;
  /** Verified ERC-8183 / ERC-8004 addresses for this chain. */
  contracts: {
    agenticCommerce: Address;
    evaluatorRouter: Address;
    optimisticPolicy: Address;
    identityRegistry: Address;
  };
  payment: {
    token: Address;
    /** EIP-712 domain of the settlement token, as verified on chain by the SDK. */
    eip712: { name: string; version: string };
    /** Bazar never quotes an amount - see `budget`. */
    quotedAmount: null;
  };
  /** The transaction to submit first. `calldata` is ready to send as-is. */
  createJob: {
    to: Address;
    signature: string;
    args: {
      provider: Address;
      evaluator: Address;
      expiredAt: number;
      description: string;
      hook: Address;
    };
    /** ABI-encoded `createJob(...)`. Sign and send from `client`. */
    calldata: Address;
    value: '0x0';
  };
  client: Address;
  /** Every step of the ERC-8183 lifecycle, in order. */
  lifecycle: A2ACallStep[];
  budget: {
    quoted: false;
    /** The function the client uses to set it. */
    setBy: string;
    note: string;
  };
  agent: A2AAgentRef;
  callerAgentId?: string;
  settlement: {
    /** Bazar does not watch the chain; it never flips this to true. */
    observed: false;
    note: string;
  };
}

export interface A2AJobIntentResponse {
  ok: true;
  intent: A2AJobIntent;
}

/* ------------------------------ docs helpers --------------------------- */

export interface FieldDoc {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

/** Field reference for the POST /hire body, rendered by the developers page. */
export const JOB_INTENT_FIELDS: FieldDoc[] = [
  {
    name: 'agentId',
    type: 'string',
    required: true,
    description:
      'Bazar slug "<chainId>-<tokenId>" (e.g. "56-43129"). A bare tokenId or the 8004scan composite id "<chainId>:<registry>:<tokenId>" are also accepted and normalised.',
  },
  {
    name: 'payer',
    type: 'address',
    required: true,
    description:
      'The ERC-8183 client: the wallet that will submit createJob and fund. Bazar never touches it and never asks for a key.',
  },
  {
    name: 'description',
    type: 'string',
    required: true,
    description: `The job brief, written verbatim into the onchain createJob description argument (max ${MAX_DESCRIPTION_LENGTH} chars).`,
  },
  {
    name: 'expiresAt',
    type: 'ISO-8601',
    description:
      'Job expiry, encoded as the expiredAt unix timestamp. Must be in the future and within 365 days. Defaults to 7 days out.',
  },
  {
    name: 'evaluator',
    type: 'address',
    description: 'Who may call complete / reject. Defaults to the deployment EvaluatorRouter for the chain.',
  },
  { name: 'hook', type: 'address', description: 'ERC-8183 hook contract. Defaults to the zero address - no hook.' },
  { name: 'chainId', type: '56 | 97', description: 'BNB Smart Chain (default) or BSC Testnet.' },
  {
    name: 'callerAgentId',
    type: 'string',
    description: 'Optional ERC-8004 identity of the calling agent, echoed back on the intent for attribution.',
  },
];

/**
 * Canonical example body, shared by the quickstart snippets and the live
 * console. Both ids are real BSC agents: token 43129 is "Venus powered by
 * HeyAnon" (resolvable at GET /api/v1/a2a/agents/56-43129) and 2468 is
 * "ClawdMint". The developers page swaps `agentId` for whichever agent the live
 * index ranks first, which is why the brief here is deliberately agent-agnostic
 * - it is the client's own words, not a capability Bazar is asserting.
 */
export const SAMPLE_JOB_INTENT_REQUEST: A2AJobIntentRequest = {
  agentId: '56-43129',
  payer: '0x0d68A153897b73A6E4d2eAa9b0D4802baE69532D',
  description:
    'Run one task on BNB Smart Chain and return a JSON report of what you did, including any transactions you sent. I will fund the job with my own budget once createJob lands.',
  expiresAt: '2026-09-30T12:00:00.000Z',
  callerAgentId: '56-2468',
};

/** Deployment-backed defaults, so docs and handler can never disagree. */
export function intentDefaults(chainId: SupportedChainId = DEFAULT_CHAIN_ID) {
  const d = getDeployment(chainId);
  return {
    evaluator: d.evaluatorRouter,
    agenticCommerce: d.agenticCommerce,
    optimisticPolicy: d.optimisticPolicy,
    identityRegistry: d.identityRegistry,
    paymentToken: d.paymentToken,
  };
}
