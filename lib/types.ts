/**
 * Bazar core domain types.
 *
 * Everything here traces to the live ERC-8004 index. The registries publish
 * identity and reputation only, so there is deliberately no ROI, drawdown,
 * win rate, SLA score, uptime, APY, TVL, volume, latency or hire count type
 * in this file - Bazar does not display numbers it cannot source.
 *   - Identity Registry   -> IndexedAgent (tokenId, owner, registry, protocols)
 *   - Reputation Registry -> IndexedReputation (score, feedback, stars)
 * See lib/indexer/map.ts for the mapping and lib/agents/repository.ts for the
 * query surface.
 */

export type Address = `0x${string}`;

export type CategoryId = 'rebalancing' | 'grid-trading' | 'health-factor' | 'yield';

/**
 * Whether an agent's category came from the agent's own registration text.
 *
 * ERC-8004 has no category field, so every category in Bazar is derived
 * (lib/indexer/classify.ts). This says whether the derivation had anything to
 * work with:
 *   - 'matched'      - a term in the agent's name or description matched a rule.
 *   - 'unclassified' - nothing matched, and the category is a coverage
 *                      placement by Bazar rather than a claim by the agent.
 */
export type CategoryConfidence = 'matched' | 'unclassified';

export interface Category {
  id: CategoryId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  agentType: string;
  primaryAction: string;
  keyMetric: string;
  /** Icon name from components/ui/icons (Heroicons). */
  icon: 'Scale' | 'Grid3x3' | 'HeartPulse' | 'TrendingUp';
  /** Tailwind color key under `cat.*` and hex value for inline styles */
  accent: 'rebalancing' | 'grid' | 'health' | 'yield';
  accentHex: string;
}

export interface A2AErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/* ------------------------------------------------------------------ */
/* Indexed agents - the real shape, backed by the ERC-8004 registry    */
/*                                                                    */
/* Every field here traces to something actually onchain or returned  */
/* by the 8004scan index. There is deliberately no ROI, drawdown, APY  */
/* or TVL: the registry does not publish trading performance, so Bazar */
/* does not display it. See lib/indexer/map.ts.                        */
/* ------------------------------------------------------------------ */

/**
 * Reputation as published by the ERC-8004 Reputation Registry.
 *
 * There is exactly one reader for this shape - `readReputation` in
 * lib/indexer/reputation.ts - because the index publishes two conflicting
 * `total_score` values and Bazar must never render both. Never build this
 * object by hand from a raw record.
 */
export interface IndexedReputation {
  /**
   * The canonical aggregate 8004scan score, 0-100, rounded to the two decimals
   * the index itself publishes.
   *
   * This is the leaderboard final score: the listing endpoint's `total_score`,
   * which is also carried inside the per-agent record as
   * `scores.breakdown.final_score`. It is NOT the per-agent record's stale
   * top-level `total_score`. See lib/indexer/reputation.ts for the measurement
   * that settles which is which.
   */
  totalScore: number;
  /**
   * Mean feedback score as published by the index. Measured on live BSC data
   * this is a 0-100 scale, NOT the 0-5 the field name suggests, and it is
   * frequently 0 even for agents with hundreds of feedback entries. Never
   * render it as an N-of-5 star rating, and never treat 0 as a bad score.
   */
  averageScore: number;
  starCount: number;
  totalFeedbacks: number;
  /** Composite liveness/completeness score, null when not yet computed. */
  healthScore: number | null;
  /**
   * Rank across all indexed agents, null when the record does not publish one.
   *
   * The listing endpoint omits it entirely (null on 20 of 20 rows sampled
   * 2026-08-28), so a marketplace card honestly shows no rank while a detail
   * page, which also reads the per-agent record, can show one. That is an
   * omission on one route, not a disagreement between two.
   */
  rank: number | null;
  /** Rank within this chain, null when the record does not publish one. */
  networkRank: number | null;
}

export interface IndexedAgent {
  /** URL-safe slug derived from the composite id: "<chainId>-<tokenId>". */
  slug: string;
  /** Composite 8004scan id: "<chainId>:<registry>:<tokenId>". */
  agentId: string;
  tokenId: string;
  chainId: number;
  /** Identity Registry the agent is registered in. */
  registry: Address;
  owner: Address;
  ownerLabel: string | null;
  name: string;
  description: string;
  imageUrl: string | null;
  /** True when the Identity Registry entry is verified. */
  verified: boolean;
  reputation: IndexedReputation;
  /** Declared endpoint protocols, e.g. ["A2A", "MCP", "Web"]. */
  protocols: string[];
  /** Agent advertises x402 machine payments. */
  x402: boolean;
  /**
   * The category shelf this agent is filed on.
   *
   * ERC-8004 publishes no category field, so this is always derived by Bazar
   * from the agent's own registration text (lib/indexer/classify.ts). Read
   * `categoryConfidence` before presenting it as something the agent claims:
   * when that is 'unclassified' this value is a coverage placement, not a fact
   * about the agent, and a surface that renders it as a fact is lying.
   */
  category: CategoryId;
  /**
   * Whether `category` came from the agent's own words ('matched') or from
   * Bazar's coverage placement ('unclassified'). Measured on the live index
   * 2026-08-28, 59 of the top 100 agents by reputation are 'unclassified'.
   *
   * This is the field to branch on. Do not string-match `categoryReason`.
   */
  categoryConfidence: CategoryConfidence;
  /** Why the agent landed in that category - display copy, surfaced in the UI. */
  categoryReason: string;
  registeredAt: string;
  updatedAt: string;
  /** Deterministic avatar for agents with no image. */
  avatar: { gradient: string; initials: string };
}
