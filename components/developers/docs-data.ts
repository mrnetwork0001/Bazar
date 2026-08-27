/**
 * Documentation examples generated from the live A2A implementation.
 *
 * Nothing here is hand-transcribed: every example body is produced by calling
 * the same functions the route handlers call (`queryAgents` + `toAgentSummary`,
 * `buildHireQuote`, `processHireRequest`, `getHire`, `bazarAgentCard`) against
 * the fixed `DOCS_CLOCK`, so the page cannot drift from the API.
 *
 * Server-only: this module reaches into `lib/a2a/hire-service`, which imports
 * `next/server`. Never import it from a client component.
 */
import type { A2AErrorResponse, Agent, Hire, PricingTier } from '@/lib/types';
import {
  API_BASE_PATH,
  API_BASE_URL,
  DOCS_CLOCK,
  PROTOCOL_FEE_BPS,
  QUOTE_TTL_MS,
  RATE_LIMIT_PER_MINUTE,
  bazarAgentCard,
  buildHireQuote,
  explainCalldata,
  processHireRequest,
} from '@/lib/a2a/hire-service';
import { SAMPLE_HIRE_REQUEST, toAgentSummary } from '@/lib/a2a/schema';
import { getHire } from '@/lib/a2a/store';
import { AGENTS, getAgent, queryAgents } from '@/lib/data/agents';
import { DEMO_HIRER } from '@/lib/data/hires';

export { API_BASE_PATH, API_BASE_URL, DOCS_CLOCK, PROTOCOL_FEE_BPS, QUOTE_TTL_MS, RATE_LIMIT_PER_MINUTE };

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

/* ------------------------------- the agent ------------------------------ */

export const DOCS_AGENT: Agent = getAgent('whalewatch-bsc') ?? AGENTS[0];
export const DOCS_TIER: PricingTier =
  DOCS_AGENT.pricing.find((t) => t.id === SAMPLE_HIRE_REQUEST.tierId) ?? DOCS_AGENT.pricing[0];

/* --------------------------- GET /a2a/agents ---------------------------- */

export const AGENTS_LIST_QUERY = '?category=monitoring&a2a=1&sort=sla&limit=1';

const listMatches = queryAgents({ category: 'monitoring', a2aOnly: true, sort: 'sla' });
export const AGENTS_LIST_JSON = pretty({
  ok: true,
  data: listMatches.slice(0, 1).map(toAgentSummary),
  total: listMatches.length,
  limit: 1,
  offset: 0,
});

/* ------------------------- GET /a2a/agents/{id} ------------------------- */

export const AGENT_DETAIL_JSON = pretty({ ok: true, data: DOCS_AGENT });

/* --------------------------- POST /a2a/hire ----------------------------- */

export const HIRE_REQUEST_JSON = pretty(SAMPLE_HIRE_REQUEST);

export const DOCS_QUOTE = buildHireQuote(SAMPLE_HIRE_REQUEST, DOCS_AGENT, DOCS_TIER, DOCS_CLOCK);
export const HIRE_RESPONSE_JSON = pretty(DOCS_QUOTE);
export const CALLDATA = DOCS_QUOTE.escrow.calldata;
export const CALLDATA_PARTS = explainCalldata(CALLDATA);

/** The four ABI words behind `escrow.calldata`, in `lockEscrow` argument order. */
export const CALLDATA_WORDS: { name: string; type: string; value: string; note: string }[] = [
  {
    name: 'agentTokenId',
    type: 'uint256',
    value: CALLDATA_PARTS.words[0] ?? '',
    note: `ERC-8004 Identity NFT of ${DOCS_AGENT.name} (#${DOCS_AGENT.tokenId}).`,
  },
  {
    name: 'hireId',
    type: 'bytes32',
    value: CALLDATA_PARTS.words[1] ?? '',
    note: `keccak256 of "${DOCS_QUOTE.hire.id}" — links the lock to the quote.`,
  },
  {
    name: 'payer',
    type: 'address',
    value: CALLDATA_PARTS.words[2] ?? '',
    note: 'Checksummed payer from the request, left-padded to 32 bytes.',
  },
  {
    name: 'amount',
    type: 'uint256',
    value: CALLDATA_PARTS.words[3] ?? '',
    note: `${DOCS_QUOTE.escrow.amount} ${DOCS_QUOTE.escrow.currency} in 18-decimal units (tier price + ${
      PROTOCOL_FEE_BPS / 100
    }% protocol fee).`,
  },
];

/* ------------------------- GET /a2a/hires/{id} -------------------------- */

/** A seeded hire, always resolvable — router-created hires live in memory only. */
export const HIRE_STATUS_ID = 'hire_01J8Z4Q1T6VF';
const seededHire: Hire | undefined = getHire(HIRE_STATUS_ID);
export const HIRE_STATUS_JSON = pretty({ ok: true, data: seededHire ?? DOCS_QUOTE.hire });

/* --------------------------- agent card --------------------------------- */

export const AGENT_CARD_JSON = pretty(bazarAgentCard());

/* ----------------------------- error bodies ----------------------------- */

const validation = processHireRequest({ agentId: 'whalewatch-bsc', payer: '0xnot-an-address' }, DOCS_CLOCK);
export const ERROR_400_STATUS = validation.status;
export const ERROR_400_JSON = pretty(validation.body);

const notFound = processHireRequest({ agentId: 'ghostwriter-bsc', tierId: 'task', payer: DEMO_HIRER }, DOCS_CLOCK);
export const ERROR_404_STATUS = notFound.status;
export const ERROR_404_JSON = pretty(notFound.body);

/**
 * 403 has no reproducible input: every indexed agent carries the `a2a-ready`
 * badge, so `agent.a2a.enabled` is always true. This mirrors the exact body
 * `processHireRequest` builds when it is not.
 */
const disabled: A2AErrorResponse = {
  ok: false,
  error: {
    code: 'A2A_DISABLED',
    message: `${DOCS_AGENT.name} does not accept programmatic (A2A) hires.`,
    details: { agentId: DOCS_AGENT.id },
  },
};
export const ERROR_403_JSON = pretty(disabled);

/* ---------------------------- console options --------------------------- */

export interface DocsAgentOption {
  id: string;
  name: string;
  tokenId: number;
}

/** Agents the console can hire: `a2a.enabled`, in marketplace reputation order. */
export const A2A_AGENT_OPTIONS: DocsAgentOption[] = AGENTS.filter((a) => a.a2a.enabled).map((a) => ({
  id: a.id,
  name: a.name,
  tokenId: a.tokenId,
}));
