/**
 * Derivations the landing page runs over ONE page of indexed agents.
 *
 * The home page makes exactly two calls to the index: `getMarketStats()` for
 * the headline counts and a single `queryAgents({ sort: 'reputation' })` page.
 * Everything else on the page - the hero agent, the featured row and the
 * per-category tallies - is derived from that one page here, so adding a
 * section never adds a round-trip against a 288k-row index.
 */

import { CATEGORIES } from '@/lib/data/categories';
import type { CategoryId, IndexedAgent } from '@/lib/types';

/**
 * How many top-ranked agents the landing page reasons over. 100 is the
 * indexer's maximum page size, so this is exactly one request.
 */
export const RANKED_SAMPLE_SIZE = 100;

/**
 * An agent "carries signal" when its own registration says something a reader
 * can act on: a description and at least one declared endpoint.
 *
 * Measured on the live BSC index 2026-08-28, four samples of 100 rows taken at
 * offsets 0, 50k, 150k and 250k of the default newest-first listing: 60, 64, 85
 * and 69 of each 100 declare no endpoint protocol at all, and all 400 have a
 * feedback count of zero. Empty descriptions are the narrower problem the
 * newest-first head has - 59 of the first 100 rows, but 0 of every 100 sampled
 * deeper in, so the blanks are bulk registrations arriving now rather than a
 * property of the whole index.
 *
 * This is the whole of Bazar's curation rule - it re-orders, it never invents.
 */
export function hasSignal(agent: IndexedAgent): boolean {
  return agent.description.trim().length > 0 && agent.protocols.length > 0;
}

/**
 * Reputation order, but agents that published a description and endpoints
 * float above equally-ranked blanks. Stable: both partitions keep the
 * indexer's ordering.
 */
export function pickShowcase(agents: IndexedAgent[], count: number): IndexedAgent[] {
  const signal = agents.filter(hasSignal);
  const blank = agents.filter((a) => !hasSignal(a));
  return [...signal, ...blank].slice(0, count);
}

export type CategoryCounts = Record<CategoryId, number>;

export interface CategoryTally {
  /** Per-category counts of agents whose own text matched a category rule. */
  counts: CategoryCounts;
  /** How many agents in the sample matched nothing and are shown Unclassified. */
  unclassified: number;
}

/**
 * Category share **within the ranked sample**, never across the whole index:
 * classification is local (lib/indexer/classify.ts) and the API has no
 * category field, so an index-wide per-category total does not exist. Every
 * surface that renders these numbers has to say which population they cover.
 *
 * Only agents with `categoryConfidence === 'matched'` are counted. An agent
 * that matched no rule still carries a `category` - a hash placement that keeps
 * coverage even, measured at 59 of the top 100 by reputation on 2026-08-28 - and
 * counting those would have published Bazar's arithmetic as if the agents had
 * claimed it. They are reported as one Unclassified figure instead.
 */
export function tallyCategories(agents: IndexedAgent[]): CategoryTally {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as CategoryCounts;
  let unclassified = 0;
  for (const agent of agents) {
    if (agent.categoryConfidence === 'matched') counts[agent.category] += 1;
    else unclassified += 1;
  }
  return { counts, unclassified };
}
