/**
 * What a PancakeSwap trader or LP is actually trying to get done, and the
 * evidence Bazar will accept that an agent does it.
 *
 * ERC-8004 publishes no venue field and no capability field. An agent is a
 * name, a description, an owner and a set of declared endpoints. So every
 * judgement on the /pancakeswap lane reduces to one question that can be
 * checked by reading: does the agent's own registration text say this?
 *
 * Two gates, in order, and both are keyword tests on text the registrant
 * wrote:
 *
 *   1. VENUE  - the text names PancakeSwap. Without this the agent does not
 *               enter the lane at all, however good it looks.
 *   2. JOB    - the text names a trader or LP job (below). Without this the
 *               agent is listed as unplaced rather than filed under a job it
 *               never claimed.
 *
 * Nothing here is a quality judgement, an endorsement or a verification that
 * the agent works. It is a reading of what the agent says about itself, and
 * every surface that renders it quotes the sentence it read.
 */

/* --------------------------------- venue --------------------------------- */

/**
 * Free-text queries sent to the 8004scan listing endpoint to build the
 * candidate pool.
 *
 * These are a recall net, not the evidence: the index's `search` matches
 * LLM-derived tags as well as registration text, so a row coming back proves
 * nothing on its own (see `VENUE_PATTERN`). The two venue queries carry the
 * lane - measured 2026-09-07, a 27-term sweep over 1,551 distinct identities
 * (pancakeswap, pancake, cake, concentrated liquidity, liquidity pool,
 * impermanent loss, liquidity, LP, pool, slippage, v3, yield, APR, APY,
 * rebalance, arbitrage, honeypot, rug pull, token safety, MEV, farming, DEX,
 * AMM, price impact, fee tier, range) surfaced exactly 70 agents naming
 * PancakeSwap in their own text, and `pancakeswap` plus `pancake` alone found
 * all 70. `pcs`, `v3` and `liquidity pool` are kept as cheap recall insurance
 * for identities registered after that sweep which name the venue in a form
 * the two headline queries would tokenise past.
 */
export const SEARCH_TERMS = ['pancakeswap', 'pancake', 'pcs', 'v3', 'liquidity pool'] as const;

/**
 * The venue gate. Deliberately narrow: it must be PancakeSwap the venue, not
 * a word that rhymes with it.
 *
 * `cake` is not here. CAKE is PancakeSwap's token, but "cake" in a
 * registration string is far more often a cake - the index's own `search=cake`
 * returns one agent, "RAF - He makes cakes" - and a token ticker is not a
 * claim to serve the exchange's traders anyway.
 */
export const VENUE_PATTERN = /pancakeswap|pancake[\s-]?swap|pancake|\bpcs\s?v[23]\b/i;

/* --------------------------------- jobs ---------------------------------- */

export type LaneIntentId = 'position' | 'yield' | 'research' | 'safety';

export interface LaneIntent {
  id: LaneIntentId;
  /** Section heading. */
  name: string;
  /** The trader's own words for the problem, in the first person. */
  question: string;
  /** What agents in this group say they do. */
  summary: string;
  /** Icon name from components/ui/icons. */
  icon: 'Scale' | 'TrendingUp' | 'Radar' | 'ShieldCheck';
  accentHex: string;
  /**
   * Phrases that name this job unambiguously. At least one must appear in the
   * agent's own text before it can be filed here - a single generic word like
   * "monitor" or "reward" is never enough on its own, because almost every
   * agent on the index uses one.
   */
  naming: readonly string[];
  /** Phrases that corroborate a naming phrase but cannot carry a placement. */
  supporting: readonly string[];
}

/**
 * The four jobs, in the order a placement tie is broken.
 *
 * The order is not arbitrary: `research` is last because "reads a pool and
 * reports" is what an agent doing any of the other three also does, so it must
 * never win a tie against a more specific claim.
 *
 * Chinese phrases sit beside the English ones because the registry is
 * multilingual and dropping them silently loses real agents - BNB Monitor
 * (token 252473) describes itself only as reading PancakeSwap pool quotes
 * onchain, in Chinese.
 */
export const LANE_INTENTS: readonly LaneIntent[] = [
  {
    id: 'position',
    name: 'Position management',
    question: 'My v3 range keeps drifting out. Who watches it and tells me when to move?',
    summary:
      'Agents that read a concentrated-liquidity position or a grid and say whether it is still working: in range or out, how far the price has travelled, which fee tier, what rebalance would put it back to work.',
    icon: 'Scale',
    accentHex: '#22D3EE',
    naming: [
      'rebalanc', 're-balanc', '再平衡',
      'concentrated liquidity', 'liquidity position', 'liquidity range',
      'lp position', 'lp nft', 'lp range', 'v3 lp', 'lp assistant', 'lp monitor',
      'in range', 'out of range', 'range boundary', 'range state', 'range assessment',
      'position-range', 'position range', 'stopped earning fees',
      'impermanent loss', 'reposition', 'fee tier', 'uncollected fee',
      'grid level', 'grid plan', 'grid step', 'grid config', 'grid trad',
      'caller-declared grid', 'market making', '做市',
    ],
    supporting: ['widen', 'drifted', 'compounding', 'position health', 'routes liquidity', 'rungs'],
  },
  {
    id: 'yield',
    name: 'Yield discovery',
    question: 'Where should this capital sit right now, and what does it actually earn net?',
    summary:
      'Agents that compare where liquidity could go and rank the options - fee APR against pool, farm or lending route - rather than managing a position you already hold.',
    icon: 'TrendingUp',
    accentHex: '#A78BFA',
    naming: [
      'apr', 'apy', 'yield', '收益', 'farm', 'harvest', 'best rate',
      'capital efficiency', 'risk adjusted', 'risk-adjusted',
      'liquidity to the best', 'fee opportunit',
    ],
    supporting: ['optimis', 'optimiz', 'reward', 'compound'],
  },
  {
    id: 'safety',
    name: 'Swap safety',
    question: 'Before I sign this, what can it cost me that I have not priced in?',
    summary:
      'Agents that put a check between a trader and a transaction: slippage and price impact, honeypot and contract screening, a simulation, a spend cap, or a refusal receipt when the trade fails its own policy.',
    icon: 'ShieldCheck',
    accentHex: '#34D399',
    naming: [
      'slippage', '滑点', 'price impact', 'sandwich', 'honeypot', 'rug',
      'security check', 'safe execution', 'risk cap', 'spend limit', 'stop loss',
      'goplus', 'net edge', 'covers its own cost', 'loses money', 'viability',
    ],
    supporting: ['simulat', 'validat', 'mev', 'refus', 'risk control'],
  },
  {
    id: 'research',
    name: 'Pool research',
    question: 'What is this pool actually doing before I put money into it?',
    summary:
      'Agents that read live pool and market state and hand back a reading - tick, quote, TWAP, cross-venue price, a written brief - without taking a position of their own.',
    icon: 'Radar',
    accentHex: '#F0B90B',
    naming: [
      'pool data', 'pool state', 'live pool', 'pool tick', 'pool quote', '池报价', '行情',
      'price feed', 'oracle', 'twap', 'market brief', 'market data', 'price discrep',
      'analytic', 'research', 'live price', "pool's live", 'token metrics', 'radar',
    ],
    // "live quote" sits here rather than above on purpose. A launchpad that
    // quotes its own bonding curve and mentions PancakeSwap only as the venue
    // a graduated token migrates to is not a pool research service, and on its
    // own that phrase was filing exactly that agent under this job.
    supporting: [
      'live quote', 'monitor', '监控', 'observ', 'reports', 'scan', 'evidence', 'assessment',
    ],
  },
] as const;

export const LANE_INTENT_MAP: Record<LaneIntentId, LaneIntent> = Object.fromEntries(
  LANE_INTENTS.map((i) => [i.id, i]),
) as Record<LaneIntentId, LaneIntent>;

/** Every phrase the lane looks for, across all four jobs. Used for the method note. */
export const JOB_PHRASE_COUNT = LANE_INTENTS.reduce(
  (n, i) => n + i.naming.length + i.supporting.length,
  0,
);

/**
 * The date the 27-term / 1,551-identity sweep quoted above was run.
 *
 * Written down rather than computed, because it is a claim about a measurement
 * that happened once, not about now. The lane's live figures are measured on
 * every render; this one is not, and dating it is what keeps the difference
 * visible.
 */
export const SWEEP_DATE = '7 September 2026';
export const SWEEP_TERMS = 27;
export const SWEEP_IDENTITIES = 1551;
export const SWEEP_NAMED = 70;
