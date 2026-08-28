import type { Category, CategoryId } from '@/lib/types';

/**
 * The four categories the BNB Agent Studio Marketplace brief specifies:
 * Rebalancing, Grid Trading, Yield Optimisation, Health Factor Monitoring.
 *
 * These are graded ("Agent Diversity: balanced coverage across all four
 * categories"), so the set is fixed by the brief and must not drift.
 */
export const CATEGORIES: Category[] = [
  {
    id: 'rebalancing',
    name: 'Rebalancing',
    shortName: 'Rebalancing',
    tagline: 'Portfolio weight keepers',
    description:
      'Agents that hold a target allocation across BSC assets, trimming winners and topping up laggards as prices move, so a portfolio keeps its intended risk shape without manual work.',
    agentType: 'Portfolio Rebalancers',
    primaryAction: 'Drift-triggered portfolio rebalancing',
    keyMetric: 'Allocation drift held',
    icon: 'Scale',
    accent: 'rebalancing',
    accentHex: '#22D3EE',
  },
  {
    id: 'grid-trading',
    name: 'Grid Trading',
    shortName: 'Grid',
    tagline: 'Automated DEX traders',
    description:
      'PancakeSwap grid bots, range managers and cross-DEX arbitrage agents that place laddered orders and harvest volatility inside a defined band.',
    agentType: 'Automated DEX Traders',
    primaryAction: 'PancakeSwap grid trading & arbitrage',
    keyMetric: 'Reputation score',
    icon: 'Grid3x3',
    accent: 'grid',
    accentHex: '#F0B90B',
  },
  {
    id: 'yield',
    name: 'Yield Optimisation',
    shortName: 'Yield',
    tagline: 'APY maximisers',
    description:
      'Capital routers that continuously compare and rebalance across BSC lending markets, LPs and liquid staking to chase the best net yield after gas.',
    agentType: 'APY Maximisers',
    primaryAction: 'Capital routing across BSC yield venues',
    keyMetric: 'Reputation score',
    icon: 'TrendingUp',
    accent: 'yield',
    accentHex: '#A78BFA',
  },
  {
    id: 'health-factor',
    name: 'Health Factor',
    shortName: 'Health',
    tagline: 'Liquidation monitors',
    description:
      'Venus and Lista collateral guardians that watch a position every block and repay or top up before the health factor crosses the liquidation threshold.',
    agentType: 'DeFi Liquidation Monitors',
    primaryAction: 'Venus collateral monitoring & auto-repay',
    keyMetric: 'Reputation score',
    icon: 'HeartPulse',
    accent: 'health',
    accentHex: '#34D399',
  },
];

export const CATEGORY_MAP: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, Category>;

export function getCategory(id: string | null | undefined): Category | undefined {
  if (!id) return undefined;
  return CATEGORY_MAP[id as CategoryId];
}

export function isCategoryId(id: string | null | undefined): id is CategoryId {
  return !!id && id in CATEGORY_MAP;
}
