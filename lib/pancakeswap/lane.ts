/**
 * Builds the PancakeSwap lane from the live ERC-8004 index.
 *
 * Bazar has no relationship with PancakeSwap and no privileged list. This
 * module queries the same public index every other page reads, then applies
 * the two gates in lib/pancakeswap/intents.ts to what comes back. Everything
 * it returns is either a record from the index or a count of records from the
 * index; nothing is authored here.
 *
 * The one thing this file is careful about is the difference between "the
 * index says so" and "the agent says so". 8004scan enriches records with an
 * LLM: a token can carry the tag "pancakeswap" while its registration text
 * never mentions the exchange (token 154332, a trading-card NFT, is tagged
 * pancakeswap with `field_sources.tags = "llm_parser"`). The index's free-text
 * `search` matches those tags, so a search hit is a candidate and nothing
 * more. Only `VENUE_PATTERN` against the agent's own name and description
 * admits it to the lane, and the sentence that matched is carried through to
 * the UI so a reader can check the call.
 */

import { BSC_MAINNET, type SupportedChainId } from '@/lib/chain/addresses';
import { mapAgents } from '@/lib/indexer/map';
import { fetchAgentCount, fetchAgents, ScanError, type ScanAgent } from '@/lib/indexer/scan-client';
import type { IndexedAgent } from '@/lib/types';
import { LANE_INTENTS, SEARCH_TERMS, VENUE_PATTERN, type LaneIntentId } from './intents';

/* --------------------------------- types --------------------------------- */

/** Where in the agent's own registration text the evidence was found. */
export type EvidenceField = 'name' | 'description';

export interface VenueEvidence {
  /** The venue phrase, exactly as the registrant capitalised it. */
  match: string;
  field: EvidenceField;
  /** The phrase in context, so the claim can be checked rather than trusted. */
  quote: string;
  /** True when the quote is a window cut out of a longer description. */
  truncated: boolean;
}

export interface JobEvidence {
  intent: LaneIntentId;
  /**
   * The words that named this job, quoted from the agent's own text.
   *
   * These are surface forms, not the patterns that matched them: the lane
   * looks for the stem "rebalanc" but shows the registrant's own
   * "auto-rebalancing", because a chip reading "rebalanc" would be Bazar's
   * vocabulary presented as the agent's. Never empty.
   */
  naming: string[];
  /** Corroborating words. May be empty; can never carry a placement alone. */
  supporting: string[];
  score: number;
}

/** Another indexed identity whose registration text is identical to this one's. */
export interface TwinIdentity {
  tokenId: string;
  slug: string;
  name: string;
}

export interface LaneAgent {
  agent: IndexedAgent;
  venue: VenueEvidence;
  job: JobEvidence;
  /** Other jobs the same text also names, shown as context, not as a placement. */
  alsoNames: LaneIntentId[];
  /** Identities registering the same text. The lane shows one card for the set. */
  twins: TwinIdentity[];
}

/** Named PancakeSwap, but described no trader or LP job Bazar could read. */
export interface UnplacedAgent {
  agent: IndexedAgent;
  venue: VenueEvidence;
  /** Identities sharing this exact registration text. */
  twins: TwinIdentity[];
}

export interface LaneGroup {
  intent: LaneIntentId;
  /** Distinct registration texts, highest reputation first. */
  agents: LaneAgent[];
  /** Identities in the group, including twins collapsed into a card. */
  identityCount: number;
}

export interface LaneResult {
  /** True when the index could not be reached. Not evidence about any agent. */
  degraded: boolean;
  error?: string;
  searchTerms: readonly string[];
  /** Distinct identities the searches returned. */
  examined: number;
  /** Of those, how many name PancakeSwap in their own name or description. */
  named: number;
  /** Candidates whose only link to PancakeSwap was index-derived, not written. */
  tagOnly: number;
  /** Identities filed under a job. */
  placedIdentities: number;
  /** Distinct registration texts filed under a job - the number of real offers. */
  placedOffers: number;
  groups: LaneGroup[];
  unplaced: UnplacedAgent[];
  /** Every ERC-8004 identity on the chain, for the size of the haystack. */
  indexedTotal: number | null;
}

/* ------------------------------- evidence -------------------------------- */

const QUOTE_BEFORE = 90;
const QUOTE_AFTER = 130;

/**
 * Finds the venue phrase in the agent's own text and cuts a readable window
 * around it.
 *
 * The name is checked before the description because a name that says
 * "PancakeSwap LP Monitor" is the strongest form of the claim, and quoting the
 * name back is clearer than quoting a fragment of prose that repeats it.
 */
function findVenue(agent: IndexedAgent): VenueEvidence | null {
  const fields: ReadonlyArray<[EvidenceField, string]> = [
    ['name', agent.name],
    ['description', agent.description],
  ];

  for (const [field, text] of fields) {
    const hit = VENUE_PATTERN.exec(text);
    if (!hit) continue;
    if (field === 'name') {
      return { match: hit[0], field, quote: text, truncated: false };
    }
    const start = Math.max(0, hit.index - QUOTE_BEFORE);
    const end = Math.min(text.length, hit.index + hit[0].length + QUOTE_AFTER);
    const slice = text.slice(start, end).replace(/\s+/g, ' ').trim();
    return { match: hit[0], field, quote: slice, truncated: start > 0 || end < text.length };
  }
  return null;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * The registrant's own word for a phrase the lane matched.
 *
 * The lane matches on stems so that "rebalance", "rebalances" and
 * "auto-rebalancing" all count as the same claim, but a stem is Bazar's
 * shorthand and must never be quoted back as if the agent had written it. This
 * grows the match outwards to the word it sits inside and returns that,
 * verbatim and with the registrant's own capitalisation.
 */
function surfaceForm(text: string, phrase: string): string | null {
  const at = text.toLowerCase().indexOf(phrase);
  if (at < 0) return null;
  let start = at;
  let end = at + phrase.length;
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start -= 1;
  while (end < text.length && WORD_CHAR.test(text[end])) end += 1;
  return text.slice(start, end);
}

/** Surface forms for every phrase that hit, in text order, without repeats. */
function surfaceForms(text: string, phrases: readonly string[]): string[] {
  const lower = text.toLowerCase();
  const hits = phrases
    .map((phrase) => ({ phrase, at: lower.indexOf(phrase) }))
    .filter((hit) => hit.at >= 0)
    .sort((a, b) => a.at - b.at);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const hit of hits) {
    const word = surfaceForm(text, hit.phrase);
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }
  return out;
}

/**
 * Reads every job the agent's own text names.
 *
 * A job is only reported when at least one `naming` phrase is present.
 * Supporting phrases raise the score - which decides the primary placement
 * when an agent names two jobs - but can never open a group on their own. That
 * rule is what keeps "monitor" or "reward", words most of the index uses, from
 * filing an agent under work it never claimed.
 *
 * The score counts patterns matched, not words shown: two stems can collapse
 * onto one surface form, and a placement must not shift because of how the
 * evidence happens to read.
 */
function readJobs(agent: IndexedAgent): JobEvidence[] {
  const text = `${agent.name} ${agent.description}`;
  const haystack = text.toLowerCase();
  const found: JobEvidence[] = [];

  for (const intent of LANE_INTENTS) {
    const naming = intent.naming.filter((p) => haystack.includes(p));
    if (naming.length === 0) continue;
    const supporting = intent.supporting.filter((p) => haystack.includes(p));
    found.push({
      intent: intent.id,
      naming: surfaceForms(text, naming),
      supporting: surfaceForms(text, supporting),
      score: naming.length * 2 + supporting.length,
    });
  }

  // Score first; on a tie the declared order of LANE_INTENTS wins, which puts
  // `research` last on purpose - reading a pool is what an agent doing any of
  // the other three jobs also does, so it must not beat a specific claim.
  const rank = new Map(LANE_INTENTS.map((intent, n) => [intent.id, n]));
  return found.sort(
    (a, b) => b.score - a.score || (rank.get(a.intent) ?? 0) - (rank.get(b.intent) ?? 0),
  );
}

/* -------------------------------- fetching -------------------------------- */

function errorMessage(err: unknown): string {
  if (err instanceof ScanError) return err.message;
  return err instanceof Error ? err.message : String(err);
}

interface TermResult {
  term: string;
  items?: ScanAgent[];
}

/**
 * Runs every recall query in parallel and returns the distinct rows.
 *
 * A single failed query is not fatal: the lane is a union, so one term timing
 * out narrows the candidate pool rather than emptying it. The count of terms
 * that did answer is what the page reports as having been searched, so a
 * partial sweep never gets described as a complete one.
 */
async function fetchCandidates(
  chainId: SupportedChainId,
  revalidateSeconds: number,
): Promise<{ rows: ScanAgent[]; terms: string[]; failures: string[] }> {
  const settled: TermResult[] = await Promise.all(
    SEARCH_TERMS.map(async (term): Promise<TermResult> => {
      try {
        const page = await fetchAgents({ chainId, search: term, limit: 100 }, revalidateSeconds);
        return { term, items: page.items };
      } catch {
        return { term };
      }
    }),
  );

  const byToken = new Map<string, ScanAgent>();
  const terms: string[] = [];
  const failures: string[] = [];

  for (const result of settled) {
    if (!result.items) {
      failures.push(result.term);
      continue;
    }
    terms.push(result.term);
    for (const row of result.items) {
      if (row.chain_id === chainId) byToken.set(row.token_id, row);
    }
  }

  return { rows: [...byToken.values()], terms, failures };
}

/* --------------------------------- lane ---------------------------------- */

/** Registration text, normalised so two identical registrations collide. */
function textKey(agent: IndexedAgent): string {
  return `${agent.name} ${agent.description}`.replace(/\s+/g, ' ').trim().toLowerCase();
}

function toTwin(agent: IndexedAgent): TwinIdentity {
  return { tokenId: agent.tokenId, slug: agent.slug, name: agent.name };
}

/**
 * Build the whole lane.
 *
 * Cached for 30 minutes by the Next data cache. The lane is five listing
 * queries wide and the index answers each in roughly two seconds, so the
 * window is what keeps a page view from costing a fresh sweep; the count of
 * identities on the chain beside it is read on the same clock, so the two
 * figures on one screen cannot contradict each other.
 */
export async function buildLane(
  chainId: SupportedChainId = BSC_MAINNET,
  revalidateSeconds = 1800,
): Promise<LaneResult> {
  const [candidates, indexedTotal] = await Promise.all([
    fetchCandidates(chainId, revalidateSeconds),
    fetchAgentCount(chainId, revalidateSeconds).catch(() => null),
  ]);

  if (candidates.terms.length === 0) {
    return {
      degraded: true,
      error: `no index query answered (${candidates.failures.join(', ')})`,
      searchTerms: [],
      examined: 0,
      named: 0,
      tagOnly: 0,
      placedIdentities: 0,
      placedOffers: 0,
      groups: [],
      unplaced: [],
      indexedTotal,
    };
  }

  const examined = mapAgents(candidates.rows);

  // Gate 1: the agent's own words name the venue. A search hit alone does not
  // qualify - the index matches its own LLM-derived tags too.
  const admitted: Array<{ agent: IndexedAgent; venue: VenueEvidence }> = [];
  for (const agent of examined) {
    const venue = findVenue(agent);
    if (venue) admitted.push({ agent, venue });
  }

  // Identities registering identical text are collapsed to one card. Seven
  // copies of the same oracle bot are one offer a trader can take, not seven,
  // and a group count that says otherwise overstates the choice on the shelf.
  const clusters = new Map<string, IndexedAgent[]>();
  for (const { agent } of admitted) {
    const key = textKey(agent);
    const bucket = clusters.get(key);
    if (bucket) bucket.push(agent);
    else clusters.set(key, [agent]);
  }
  for (const bucket of clusters.values()) {
    bucket.sort(
      (a, b) =>
        b.reputation.totalScore - a.reputation.totalScore || Number(b.tokenId) - Number(a.tokenId),
    );
  }

  // Gate 2: the agent's own words name a trader or LP job.
  const placed = new Map<LaneIntentId, LaneAgent[]>();
  const unplaced: UnplacedAgent[] = [];
  let placedIdentities = 0;

  for (const { agent, venue } of admitted) {
    const cluster = clusters.get(textKey(agent)) ?? [agent];
    // One card per distinct registration text: only the representative builds
    // an entry, the rest are listed on it as twins.
    if (cluster[0].tokenId !== agent.tokenId) continue;
    const twins = cluster.slice(1).map(toTwin);

    const jobs = readJobs(agent);
    if (jobs.length === 0) {
      unplaced.push({ agent, venue, twins });
      continue;
    }

    const [job, ...rest] = jobs;
    const bucket = placed.get(job.intent) ?? [];
    bucket.push({ agent, venue, job, alsoNames: rest.map((j) => j.intent), twins });
    placed.set(job.intent, bucket);
    placedIdentities += cluster.length;
  }

  // Only groups with real agents in them. An empty shelf under a heading is a
  // claim that the shelf could have been filled, and it could not.
  const groups: LaneGroup[] = [];
  for (const intent of LANE_INTENTS) {
    const agents = placed.get(intent.id);
    if (!agents || agents.length === 0) continue;
    agents.sort(
      (a, b) =>
        b.agent.reputation.totalScore - a.agent.reputation.totalScore ||
        b.job.score - a.job.score ||
        Number(b.agent.tokenId) - Number(a.agent.tokenId),
    );
    groups.push({
      intent: intent.id,
      agents,
      identityCount: agents.reduce((n, a) => n + 1 + a.twins.length, 0),
    });
  }

  unplaced.sort((a, b) => b.agent.reputation.totalScore - a.agent.reputation.totalScore);

  return {
    degraded: false,
    error: candidates.failures.length
      ? `${candidates.failures.join(', ')} did not answer`
      : undefined,
    searchTerms: candidates.terms,
    examined: examined.length,
    named: admitted.length,
    tagOnly: examined.length - admitted.length,
    placedIdentities,
    placedOffers: groups.reduce((n, g) => n + g.agents.length, 0),
    groups,
    unplaced,
    indexedTotal,
  };
}
