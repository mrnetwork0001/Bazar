import type { Category, CategoryId } from '@/lib/types';

export const CATEGORIES: Category[] = [
  {
    id: 'monitoring',
    name: 'Monitoring',
    shortName: 'Monitoring',
    tagline: 'Whale & market trackers',
    description:
      'Real-time wallet, liquidity and mempool surveillance across BSC. Sub-second alerts for whale moves, LP shifts and price deviations.',
    agentType: 'Whale & Market Trackers',
    primaryAction: 'Real-time wallet & liquidity alerts',
    keyMetric: 'Alert Latency (<1s)',
    keyMetricKey: 'avgResponseMs',
    icon: 'Radar',
    accent: 'monitoring',
    accentHex: '#22D3EE',
  },
  {
    id: 'grid-trading',
    name: 'Grid Trading',
    shortName: 'Grid',
    tagline: 'Automated DEX traders',
    description:
      'PancakeSwap grid bots, range managers and cross-DEX arbitrage agents with verified on-chain track records.',
    agentType: 'Automated DEX Traders',
    primaryAction: 'PancakeSwap grid trading & arbitrage',
    keyMetric: '7-Day ROI %',
    keyMetricKey: 'roi7d',
    icon: 'Grid3x3',
    accent: 'grid',
    accentHex: '#F0B90B',
  },
  {
    id: 'health-factor',
    name: 'Health Factor',
    shortName: 'Health',
    tagline: 'DeFi liquidation monitors',
    description:
      'Venus Protocol and Lista DAO collateral guardians that watch your health factor and auto-repay before liquidation.',
    agentType: 'DeFi Liquidation Monitors',
    primaryAction: 'Venus Protocol collateral adjustment',
    keyMetric: 'Liquidation Prevention Rate',
    keyMetricKey: 'winRate',
    icon: 'HeartPulse',
    accent: 'health',
    accentHex: '#34D399',
  },
  {
    id: 'yield',
    name: 'Yield Optimization',
    shortName: 'Yield',
    tagline: 'APY maximizers',
    description:
      'Capital routers that continuously rebalance across BSC lending markets, LPs and liquid staking to maximize net APY.',
    agentType: 'APY Maximizers',
    primaryAction: 'Capital routing across BSC yield pools',
    keyMetric: 'Net APY %',
    keyMetricKey: 'roi30d',
    icon: 'TrendingUp',
    accent: 'yield',
    accentHex: '#A78BFA',
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
