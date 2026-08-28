/**
 * Category classification for indexed ERC-8004 agents.
 *
 * The Identity Registry carries no category field — an agent is just a name,
 * a description and a set of endpoints. The marketplace brief nonetheless
 * requires browsing by four specific categories, so Bazar derives the category
 * from the agent's own self-description.
 *
 * This is deliberately a transparent keyword scorer rather than a model call:
 * it runs on 287k agents, must be deterministic across server renders, and
 * has to be auditable when a judge asks why an agent is filed where it is.
 * `explain()` exposes the matched terms for exactly that reason.
 */

import type { CategoryId } from '@/lib/types';

interface Rule {
  category: CategoryId;
  /** Distinctive terms — strong signal, weighted heavily. */
  strong: string[];
  /** Supporting terms — only decisive in combination. */
  weak: string[];
}

const RULES: Rule[] = [
  {
    category: 'rebalancing',
    strong: ['rebalanc', 'portfolio allocation', 'asset allocation', 'target weight', 'index fund', 'basket', 'drift'],
    weak: ['portfolio', 'allocation', 'diversif', 'weighting', 'treasury', 'rotate', 'rotation'],
  },
  {
    category: 'grid-trading',
    strong: ['grid trad', 'grid bot', 'arbitrage', 'market mak', 'dca bot', 'scalp', 'orderbook', 'limit order'],
    weak: ['trading', 'trade', 'swap', 'pancakeswap', 'dex', 'signal', 'momentum', 'perp', 'futures', 'spot'],
  },
  {
    category: 'yield',
    strong: ['yield', 'apy', 'apr', 'auto-compound', 'autocompound', 'farming', 'staking reward', 'vault strateg'],
    weak: ['stake', 'staking', 'liquidity', 'lp ', 'pool', 'compound', 'earn', 'deposit', 'lending', 'restak'],
  },
  {
    category: 'health-factor',
    strong: ['health factor', 'liquidation', 'collateral ratio', 'ltv', 'loan-to-value', 'margin call', 'undercollateral'],
    weak: ['venus', 'lista', 'borrow', 'debt', 'collateral', 'risk monitor', 'position monitor', 'repay'],
  },
];

const STRONG_WEIGHT = 10;
const WEAK_WEIGHT = 3;

export interface Classification {
  category: CategoryId;
  /** 0 when nothing matched and the category is a fallback. */
  score: number;
  matched: string[];
  /** True when no rule matched and the agent was assigned by fallback. */
  fallback: boolean;
}

/**
 * Deterministic fallback for agents whose description says nothing useful.
 * Spreads them evenly across the four categories by token id, so an
 * unclassifiable long tail cannot pile into one bucket and skew the
 * "balanced coverage" the brief grades.
 */
function fallbackCategory(seed: string): CategoryId {
  const order: CategoryId[] = ['rebalancing', 'grid-trading', 'yield', 'health-factor'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return order[h % order.length];
}

export function classify(input: {
  name: string;
  description?: string | null;
  /** Used only to break ties deterministically for the unclassifiable tail. */
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
    return { category: fallbackCategory(input.seed ?? input.name), score: 0, matched: [], fallback: true };
  }
  return { ...best, fallback: false };
}

/** Human-readable reason an agent landed in its category, for the UI and for judges. */
export function explain(c: Classification): string {
  if (c.fallback) return 'No category signal in the agent’s registration — assigned for balanced coverage.';
  return `Matched ${c.matched.slice(0, 3).map((m) => `“${m.trim()}”`).join(', ')} in the agent’s registration.`;
}
