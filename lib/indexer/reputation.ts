/**
 * The single canonical reading of ERC-8004 reputation.
 *
 * Bazar's whole claim is that the human page and the machine endpoint cannot
 * disagree, so exactly one module is allowed to decide what "the score" is.
 * Every consumer - the card, the sort order, the detail page, the A2A API -
 * reaches `IndexedReputation` through `readReputation` here, via `mapAgent`.
 *
 * ---------------------------------------------------------------------------
 * Why this module exists: the index publishes two different numbers
 * ---------------------------------------------------------------------------
 * 8004scan has two routes that both carry a `total_score`, and they disagree:
 *
 *   GET /agents?chain_id=56&sort_by=total_score   -> total_score 49.06, rank null
 *   GET /agents/56/49637                          -> total_score 30.52, rank 5
 *
 * The listing value is the one the leaderboard actually orders by, and it is
 * also present inside the per-agent record, as `scores.breakdown.final_score`:
 *
 *   GET /agents/56/49637 -> scores.breakdown.final_score = 49.05779325605201
 *
 * Measured 2026-08-28 over the live top 20 by reputation, that identity holds
 * for 20 of 20 agents: `round(scores.breakdown.final_score, 2)` is byte-equal
 * to the listing's `total_score`, while the per-agent record's own top-level
 * `total_score` lags it by 0.02 to 18.54 points. The per-agent top-level copy
 * is therefore a stale snapshot of an earlier scoring run, not a second
 * opinion, and Bazar never reads it when the breakdown is present.
 *
 * CANONICAL SCORE = round2(scores.breakdown.final_score ?? total_score)
 *
 * Because the breakdown travels inside the per-agent record, a detail page
 * that cannot reach the listing endpoint still prints the same number as the
 * card that linked to it. No extra request per card is needed.
 *
 * ---------------------------------------------------------------------------
 * Rank is not a disagreement, it is an omission
 * ---------------------------------------------------------------------------
 * `rank` and `network_rank` are null on every listing row sampled (20 of 20)
 * and populated on the per-agent record (19 of 20, both fields equal). That is
 * the same field with the same meaning, published on one route and omitted on
 * the other - so a card honestly shows no rank and the detail page shows the
 * rank, and neither contradicts the other. `mergeReputation` encodes exactly
 * that: shared fields come from the listing, and the per-agent record is only
 * allowed to fill in what the listing does not publish at all.
 */

import type { IndexedReputation } from '@/lib/types';

/**
 * The subset of an 8004scan record reputation is read from. Both the listing
 * row (`ScanAgent`) and the richer per-agent record satisfy it; only the
 * per-agent record carries `scores`.
 */
export interface ReputationSource {
  total_score?: number | null;
  average_score?: number | null;
  star_count?: number | null;
  total_feedbacks?: number | null;
  health_score?: number | null;
  rank?: number | null;
  network_rank?: number | null;
  /** Present only on `GET /agents/{chainId}/{tokenId}`. */
  scores?: unknown;
}

/** Human-readable name of the canonical field, for API docs and comments. */
export const CANONICAL_SCORE_SOURCE =
  'leaderboard final score (listing total_score, equal to scores.breakdown.final_score)';

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The index publishes scores to two decimals; match it so nothing renders 49.05779. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `scores.breakdown.final_score` when the per-agent record carries it. */
function leaderboardFinalScore(scores: unknown): number | null {
  if (scores === null || typeof scores !== 'object' || Array.isArray(scores)) return null;
  const breakdown = (scores as Record<string, unknown>).breakdown;
  if (breakdown === null || typeof breakdown !== 'object' || Array.isArray(breakdown)) return null;
  return num((breakdown as Record<string, unknown>).final_score);
}

/**
 * The one number Bazar calls "the score", wherever the record came from.
 *
 * Falls back to the record's `total_score` when no breakdown is present - on
 * the listing row that IS the canonical value, and on an unscored agent (e.g.
 * 56-149864, `scores: null`) both routes publish the same 0.0 anyway.
 */
export function canonicalTotalScore(source: ReputationSource): number {
  const final = leaderboardFinalScore(source.scores);
  return round2(final ?? num(source.total_score) ?? 0);
}

/** Project any 8004scan record onto Bazar's reputation shape. */
export function readReputation(source: ReputationSource): IndexedReputation {
  return {
    totalScore: canonicalTotalScore(source),
    averageScore: num(source.average_score) ?? 0,
    starCount: num(source.star_count) ?? 0,
    totalFeedbacks: num(source.total_feedbacks) ?? 0,
    healthScore: num(source.health_score),
    rank: num(source.rank),
    networkRank: num(source.network_rank),
  };
}

/**
 * Reconcile the two routes when a detail page has read both.
 *
 * The listing is authoritative for every field it publishes, because it is
 * what the grid, the ranking and `GET /api/v1/a2a/agents` render - a detail
 * page must not print a number the card that linked to it cannot print. The
 * per-agent record contributes only `rank` / `networkRank`, which the listing
 * never publishes at all (null on 20 of 20 rows sampled).
 *
 * `healthScore` is deliberately NOT merged: the two routes genuinely differ on
 * it for some agents (56-49637: 66.67 listing, 100.0 detail) with no tiebreak
 * available, so Bazar keeps the value its own ranking was computed from rather
 * than picking the flattering one.
 */
export function mergeReputation(
  listing: IndexedReputation,
  detail: IndexedReputation | null,
): IndexedReputation {
  if (!detail) return listing;
  return {
    ...listing,
    rank: listing.rank ?? detail.rank,
    networkRank: listing.networkRank ?? detail.networkRank,
  };
}
