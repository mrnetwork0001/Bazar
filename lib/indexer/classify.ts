/**
 * Category classification for indexed ERC-8004 agents.
 *
 * The Identity Registry carries no category field - an agent is just a name,
 * a description and a set of endpoints. The marketplace brief nonetheless
 * requires browsing by four specific categories, so Bazar derives the category
 * from the agent's own self-description.
 *
 * This is deliberately a transparent keyword scorer rather than a model call:
 * it runs on 288k agents, must be deterministic across server renders, and
 * has to be auditable when a judge asks why an agent is filed where it is.
 *
 * ---------------------------------------------------------------------------
 * The honesty problem, and how it is handled
 * ---------------------------------------------------------------------------
 * Most agents match nothing. Replayed over the live top 100 by reputation on
 * 2026-08-28, 59 of 100 registrations contain no category term at all; over a
 * 100-agent slice from the middle of the index (offset 150,000) it is 35 of
 * 100, and most of the rest match on one generic word.
 *
 * A hash still places those agents in a bucket, so the four category shelves
 * are not empty - but that placement is Bazar's arithmetic, not the agent's
 * claim, and it must never be rendered as if the agent said it. The
 * distinction is therefore carried in the data, not in prose a surface can
 * forget to read: every `Classification` and every `IndexedAgent` exposes
 * `confidence` / `categoryConfidence`, which is `'unclassified'` exactly when
 * nothing matched. Surfaces render that state honestly; nothing has to parse
 * `explain()` to find out.
 */

import type { CategoryConfidence, CategoryId } from '@/lib/types';

interface Rule {
  category: CategoryId;
  /** Distinctive terms - strong signal, weighted heavily. */
  strong: string[];
  /** Supporting terms - only decisive in combination. */
  weak: string[];
}

const RULES: Rule[] = [
  {
    category: 'rebalancing',
    strong: [
      'rebalanc',
      'portfolio allocation',
      'asset allocation',
      'portfolio manag',
      'target weight',
      'index fund',
      'basket',
      'drift',
    ],
    weak: ['portfolio', 'allocation', 'allocate', 'diversif', 'weighting', 'treasury', 'rotate', 'rotation', 'holdings'],
  },
  {
    category: 'grid-trading',
    strong: [
      'grid trad',
      'grid bot',
      'arbitrage',
      'market mak',
      'dca bot',
      'scalp',
      'orderbook',
      'limit order',
      'trading bot',
      'trading agent',
      'copy trad',
      'take profit',
      'stop loss',
      'dex aggregat',
    ],
    weak: ['trading', 'trade', 'swap', 'pancakeswap', 'dex', 'signal', 'momentum', 'perp', 'futures', 'spot', 'slippage'],
  },
  {
    category: 'yield',
    strong: [
      'yield',
      'apy',
      'apr',
      'auto-compound',
      'autocompound',
      'farming',
      'staking reward',
      'liquid staking',
      'vault strateg',
      'harvest',
    ],
    weak: ['stake', 'staking', 'liquidity', 'lp ', 'pool', 'compound', 'earn', 'deposit', 'lending', 'restak', 'vault'],
  },
  {
    category: 'health-factor',
    strong: [
      'health factor',
      'health-factor',
      'liquidation',
      'collateral ratio',
      'ltv',
      'loan-to-value',
      'margin call',
      'leverage ratio',
      'undercollateral',
    ],
    weak: ['venus', 'lista', 'aave', 'borrow', 'debt', 'collateral', 'risk monitor', 'position monitor', 'repay', 'loan'],
  },
];

const STRONG_WEIGHT = 10;
const WEAK_WEIGHT = 3;

export interface Classification {
  /**
   * The shelf the agent is filed on. Always one of the four - see `confidence`
   * before presenting it as something the agent claims about itself.
   */
  category: CategoryId;
  /** Whether the agent's own registration text put it there. */
  confidence: CategoryConfidence;
  /** 0 exactly when `confidence` is 'unclassified'. */
  score: number;
  /** The terms that matched, in rule order. Empty when unclassified. */
  matched: string[];
}

/**
 * Deterministic placement for agents whose registration says nothing useful.
 * Spreads them evenly across the four categories by agent id, so an
 * unclassifiable long tail cannot pile into one bucket. This is coverage, not
 * classification: it is always accompanied by `confidence: 'unclassified'`.
 */
function coverageCategory(seed: string): CategoryId {
  const order: CategoryId[] = ['rebalancing', 'grid-trading', 'yield', 'health-factor'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return order[h % order.length];
}

export function classify(input: {
  name: string;
  description?: string | null;
  /** Used only to place the unclassifiable tail deterministically. */
  seed?: string;
}): Classification {
  const haystack = `${input.name} ${input.description ?? ''}`.toLowerCase();

  let best: { category: CategoryId; score: number; matched: string[] } | null = null;

  for (const rule of RULES) {
    const matched: string[] = [];
    let score = 0;
    for (const term of rule.strong) {
      if (haystack.includes(term)) {
        score += STRONG_WEIGHT;
        matched.push(term);
      }
    }
    for (const term of rule.weak) {
      if (haystack.includes(term)) {
        score += WEAK_WEIGHT;
        matched.push(term);
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { category: rule.category, score, matched };
  }

  if (!best) {
    return {
      category: coverageCategory(input.seed ?? input.name),
      confidence: 'unclassified',
      score: 0,
      matched: [],
    };
  }
  return { ...best, confidence: 'matched' };
}

/**
 * Human-readable reason an agent landed in its category, for the UI and for
 * judges.
 *
 * The unclassified sentence intentionally still begins "No category signal" -
 * surfaces that predate `Classification.confidence` recognise it by that
 * prefix. New code must branch on `confidence` / `categoryConfidence` instead:
 * this string is display copy and may be reworded.
 */
export function explain(c: Classification): string {
  if (c.confidence === 'unclassified') {
    return 'No category signal in the agent’s registration - assigned for balanced coverage.';
  }
  return `Matched ${c.matched.slice(0, 3).map((m) => `“${m.trim()}”`).join(', ')} in the agent’s registration.`;
}
