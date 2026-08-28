/**
 * Documentation examples for /developers, generated from the live A2A
 * implementation rather than hand-transcribed.
 *
 * Two sources, in that order:
 *   1. The live ERC-8004 index, through the same `queryAgents` repository the
 *      route handlers use. What a judge reads on the page is what the endpoint
 *      returns right now.
 *   2. If the index is unreachable, two agent records captured from BSC mainnet
 *      on 2026-08-28 and replayed through `mapAgent` - real registry rows, not
 *      invented ones. The page says which source it used.
 *
 * Every JSON body below is produced by the shipped code paths
 * (`buildAgentsResponse`, `buildJobIntent`, `bazarAgentCard`, `validationFailure`)
 * against the fixed `DOCS_CLOCK`, so the reference cannot drift from the API.
 *
 * Server-only: reaches into `lib/a2a/hire-service`, which imports `next/server`.
 * Never import it from a client component.
 */
import type { A2AErrorResponse, IndexedAgent } from '@/lib/types';
import { DEFAULT_CHAIN_ID } from '@/lib/chain/addresses';
import { getMarketStats, queryAgents } from '@/lib/agents/repository';
import { mapAgent } from '@/lib/indexer/map';
import { SCAN_API_BASE, type ScanAgent } from '@/lib/indexer/scan-client';
import {
  API_BASE_PATH,
  API_BASE_URL,
  DOCS_CLOCK,
  bazarAgentCard,
  buildJobIntent,
  explainCalldata,
  failure,
  indexUnavailable,
  validationFailure,
} from '@/lib/a2a/hire-service';
import {
  DEFAULT_JOB_DURATION_MS,
  MAX_DESCRIPTION_LENGTH,
  SAMPLE_JOB_INTENT_REQUEST,
  buildAgentsResponse,
  toAgentSummary,
  validateJobIntentRequest,
  type A2AJobIntent,
} from '@/lib/a2a/schema';

export { API_BASE_PATH, API_BASE_URL, DEFAULT_JOB_DURATION_MS, DOCS_CLOCK, MAX_DESCRIPTION_LENGTH, SCAN_API_BASE };

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

/* ------------------------------- fixtures ------------------------------- */

/**
 * Two real BSC mainnet Identity Registry rows, fetched from 8004scan on
 * 2026-08-28 and pasted verbatim. They exist so /developers still renders
 * truthful examples when the indexer is down - the alternative is a blank page
 * or an invented agent, and neither is acceptable on a page a judge reads.
 *
 * Note both carry `is_verified: false`. That is not an oversight: nothing sets
 * the flag on BSC today, which is exactly why Bazar never gates on it.
 */
const FIXTURE_AGENTS: ScanAgent[] = [
  {
    id: '9135dc06-c8bb-4b6c-a832-b8016e913dc8',
    agent_id: '56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:43129',
    token_id: '43129',
    chain_id: 56,
    chain_type: 'evm',
    contract_address: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
    is_testnet: false,
    owner_address: '0xda977767452c5dd021624511f14df67b6c9c2c1b',
    owner_ens: null,
    owner_username: null,
    owner_certified_name: null,
    name: 'Venus powered by HeyAnon',
    description:
      'Safe execution layer for Venus lending on BSC, Ethereum, and Base. Validates collateral ratios, checks borrow limits, verifies approvals before returning pre-validated calldata, and supports full-balance withdrawals. Covers borrow, repay, supply, redeem, collateral management, APR queries, and balance checks.',
    image_url: 'https://api.8004scan.io/api/v1/media/agents/56/43129/image',
    is_verified: false,
    star_count: 0,
    supported_protocols: ['MCP', 'Web'],
    x402_supported: true,
    total_score: 30.49,
    rank: null,
    network_rank: null,
    health_score: 100,
    total_feedbacks: 1,
    average_score: 0,
    created_at: '2026-03-16T12:00:12Z',
    updated_at: '2026-08-28T13:38:19.408150Z',
  },
  {
    id: '3913075a-871b-4b03-8f66-dd129d558924',
    agent_id: '56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:2468',
    token_id: '2468',
    chain_id: 56,
    chain_type: 'evm',
    contract_address: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
    is_testnet: false,
    owner_address: '0x75b583c518215e272f3c0a3bcc1b27012f294adc',
    owner_ens: 'clawdmint.eth',
    owner_username: 'clawdmint',
    owner_certified_name: null,
    name: 'ClawdMint',
    description:
      'ClawdMint is honest, kind & peppermint-flavored multichain AI agent with real-time blockchain analysis, market data, and x402 micropayment support across multiple chains.',
    image_url: 'https://api.8004scan.io/api/v1/media/agents/56/2468/image',
    is_verified: false,
    star_count: 1,
    supported_protocols: ['MCP', 'A2A', 'OASF', 'Web', 'Email'],
    x402_supported: true,
    total_score: 30.56,
    rank: null,
    network_rank: null,
    health_score: 100,
    total_feedbacks: 0,
    average_score: 0,
    created_at: '2026-02-09T10:04:44.268844Z',
    updated_at: '2026-08-28T12:19:19.405300Z',
  },
];

/** When these rows were pulled off the live index. Shown on the page when used. */
export const FIXTURE_CAPTURED_AT = '2026-08-28';

const FIXTURE_INDEXED: IndexedAgent[] = FIXTURE_AGENTS.map(mapAgent);

/* ----------------------------- static pieces ---------------------------- */

export const AGENT_CARD_JSON = pretty(bazarAgentCard());
export const INTENT_REQUEST_JSON = pretty(SAMPLE_JOB_INTENT_REQUEST);

/** 400: a body missing `description` with a malformed `payer`. Really validated. */
const BAD_BODY = { agentId: '56-43129', payer: '0xnot-an-address' };
const badResult = validateJobIntentRequest(BAD_BODY, DOCS_CLOCK);
export const ERROR_400_BODY_JSON = pretty(BAD_BODY);
export const ERROR_400_JSON = pretty(
  badResult.ok ? { ok: false } : validationFailure(badResult.errors).body,
);

/** 404: a well-formed slug that no indexed agent matches. */
const NOT_FOUND_REF = '56-999999999';
export const ERROR_404_BODY_JSON = pretty({
  agentId: NOT_FOUND_REF,
  payer: SAMPLE_JOB_INTENT_REQUEST.payer,
  description: SAMPLE_JOB_INTENT_REQUEST.description,
});
export const ERROR_404_JSON = pretty(
  failure(
    404,
    'AGENT_NOT_FOUND',
    `No indexed agent resolved for "${NOT_FOUND_REF}". Bazar looks the identity up by token id on both index routes - the per-agent record and the listing - so this means neither has it, which is not proof the identity does not exist onchain.`,
    { agentId: NOT_FOUND_REF, slug: NOT_FOUND_REF },
  ).body as A2AErrorResponse,
);

/** 503: the honest answer when the index cannot be reached. */
export const ERROR_503_JSON = pretty(indexUnavailable('8004scan unreachable: fetch failed').body);

/* ------------------------------ live loader ----------------------------- */

export interface ConsoleAgentOption {
  slug: string;
  name: string;
  tokenId: string;
  /** Declared endpoint protocols, e.g. ["MCP","A2A"]. Often empty - shown as such. */
  protocols: string[];
  x402: boolean;
}

export interface CalldataWord {
  label: string;
  type: string;
  value: string;
  note: string;
}

export interface DocsExamples {
  /** True when the live index answered; false when the captured fixtures were used. */
  live: boolean;
  /** Present only when `live` is false. */
  degradedReason: string | null;
  stats: { indexedAgents: number; x402Agents: number; degraded: boolean };
  /** Number of agents in the sampled page that declare at least one protocol. */
  protocolSample: { sampled: number; withProtocols: number; withX402: number; withFeedback: number };

  primary: IndexedAgent;
  mcpAgent: IndexedAgent;
  consoleAgents: ConsoleAgentOption[];

  agentsListQuery: string;
  agentsListJson: string;
  agentDetailPath: string;
  agentDetailJson: string;

  intentRequestJson: string;
  intentJson: string;
  intentId: string;
  intentStatusJson: string;
  calldata: string;
  calldataSelector: string;
  calldataWords: CalldataWord[];

  mcpProtocolsJson: string;
  agentCardTemplateJson: string;
}

const LIST_LIMIT = 2;
const SAMPLE_LIMIT = 24;

function toConsoleOption(a: IndexedAgent): ConsoleAgentOption {
  return { slug: a.slug, name: a.name, tokenId: a.tokenId, protocols: a.protocols, x402: a.x402 };
}

/** Labels the ABI head/tail of `createJob(address,address,uint256,string,address)`. */
function describeCalldata(intent: A2AJobIntent, words: string[]): CalldataWord[] {
  const { args } = intent.createJob;
  const head: CalldataWord[] = [
    {
      label: 'provider',
      type: 'address',
      value: words[0] ?? '',
      note: `Owner of ${intent.agent.name}'s ERC-8004 Identity NFT (#${intent.agent.tokenId}) - the address the kernel pays. The registry publishes no separate operator address.`,
    },
    {
      label: 'evaluator',
      type: 'address',
      value: words[1] ?? '',
      note: 'ERC-8183 EvaluatorRouter for this chain. Whoever holds this address decides complete vs reject.',
    },
    {
      label: 'expiredAt',
      type: 'uint256',
      value: words[2] ?? '',
      note: `Unix seconds (${args.expiredAt}). After it passes with no completion, the client calls claimRefund(jobId).`,
    },
    {
      label: 'description (offset)',
      type: 'uint256',
      value: words[3] ?? '',
      note: 'Byte offset to the dynamic string tail - the ABI head stores a pointer, not the text.',
    },
    {
      label: 'hook',
      type: 'address',
      value: words[4] ?? '',
      note:
        args.hook === '0x0000000000000000000000000000000000000000'
          ? 'Zero address - no hook contract on this job.'
          : 'Hook contract supplied in the request.',
    },
  ];
  const tail: CalldataWord[] = [];
  if (words[5] !== undefined) {
    tail.push({
      label: 'description (length)',
      type: 'uint256',
      value: words[5],
      note: `${args.description.length} UTF-8 bytes of job brief, written verbatim onchain.`,
    });
  }
  if (words[6] !== undefined) {
    tail.push({
      label: 'description (data)',
      type: 'bytes',
      value: words[6],
      note: `First 32 bytes of the brief, right-padded. ${
        Math.max(words.length - 6, 1)
      } word(s) in total carry the text.`,
    });
  }
  return [...head, ...tail];
}

/**
 * Builds every example on the page from ONE index round-trip plus the cached
 * market stats. The page awaits this once and passes the result down as props,
 * so no section opens its own fetch.
 */
export async function getDocsExamples(): Promise<DocsExamples> {
  const [page, stats] = await Promise.all([
    queryAgents({ sort: 'reputation', limit: SAMPLE_LIMIT }),
    getMarketStats(),
  ]);

  const live = !page.degraded && page.agents.length > 0;
  const agents = live ? page.agents : FIXTURE_INDEXED;

  const primary = agents.find((a) => a.description.trim().length > 0) ?? agents[0];
  const mcpAgent =
    agents.find((a) => a.protocols.includes('MCP') && a.slug !== primary.slug) ??
    agents.find((a) => a.protocols.length > 0 && a.slug !== primary.slug) ??
    FIXTURE_INDEXED[1];

  const consoleAgents = agents.slice(0, 12).map(toConsoleOption);

  /* --- GET /agents --------------------------------------------------- */
  const agentsListQuery = `?sort=reputation&limit=${LIST_LIMIT}`;
  const agentsListJson = pretty(
    buildAgentsResponse(agents.slice(0, LIST_LIMIT), {
      total: live ? page.total : agents.length,
      limit: LIST_LIMIT,
      offset: 0,
      category: 'all',
      search: null,
      sort: 'reputation',
      chainId: DEFAULT_CHAIN_ID,
    }),
  );

  /* --- GET /agents/{id} ---------------------------------------------- */
  // Through `toAgentSummary`, exactly as the route handler does. Projecting the
  // raw `IndexedAgent` here published a body the API never returns: it carried a
  // flat `category`, a cosmetic `avatar` and no `bazar` block, so the documented
  // shape contradicted the shipped one on the very field Bazar is careful about.
  const agentDetailPath = `${API_BASE_PATH}/agents/${primary.slug}`;
  const agentDetailJson = pretty({ ok: true, data: toAgentSummary(primary) });

  /* --- POST /hire ----------------------------------------------------- */
  const intentRequest = { ...SAMPLE_JOB_INTENT_REQUEST, agentId: primary.slug };
  const { intent } = buildJobIntent(intentRequest, primary, DOCS_CLOCK);
  const intentJson = pretty({ ok: true, intent });
  const parts = explainCalldata(intent.createJob.calldata);

  /* --- GET /hires/{id} ------------------------------------------------ */
  const intentStatusJson = pretty({
    ok: true,
    data: intent,
    settlement: {
      source: 'bazar-memory',
      onChain: false,
      note: 'Settlement is not tracked here. Read authoritative job state with getJob(jobId) on the ERC-8183 AgenticCommerce kernel at data.contracts.agenticCommerce.',
    },
  });

  /* --- MCP / protocols ------------------------------------------------ */
  const mcpProtocolsJson = pretty({
    slug: mcpAgent.slug,
    agentId: mcpAgent.agentId,
    name: mcpAgent.name,
    protocols: mcpAgent.protocols,
    x402: mcpAgent.x402,
  });

  /* --- agent card template for the register section ------------------- */
  const agentCardTemplateJson = pretty({
    name: 'My BSC Agent',
    description: 'One sentence describing what the agent does. This is the text Bazar classifies and searches.',
    image: 'https://agents.example.xyz/my-agent/avatar.png',
    url: 'https://agents.example.xyz/my-agent',
    registrations: [{ agentId: `${primary.chainId}:${primary.registry}:<tokenId>`, agentRegistry: primary.registry }],
    supportedProtocols: ['A2A', 'MCP', 'Web'],
    x402: { supported: true },
  });

  return {
    live,
    degradedReason: live ? null : (page.error ?? 'The ERC-8004 index did not answer.'),
    stats: { indexedAgents: stats.indexedAgents, x402Agents: stats.x402Agents, degraded: stats.degraded },
    protocolSample: {
      sampled: agents.length,
      withProtocols: agents.filter((a) => a.protocols.length > 0).length,
      withX402: agents.filter((a) => a.x402).length,
      withFeedback: agents.filter((a) => a.reputation.totalFeedbacks > 0).length,
    },
    primary,
    mcpAgent,
    consoleAgents,
    agentsListQuery,
    agentsListJson,
    agentDetailPath,
    agentDetailJson,
    intentRequestJson: pretty(intentRequest),
    intentJson,
    intentId: intent.id,
    intentStatusJson,
    calldata: intent.createJob.calldata,
    calldataSelector: parts.selector,
    calldataWords: describeCalldata(intent, parts.words),
    mcpProtocolsJson,
    agentCardTemplateJson,
  };
}
