/**
 * Deterministic seeded mock of ERC-8004 agents on BSC.
 *
 * Everything here is derived from fixed seeds so server and client renders
 * are byte-identical (no hydration mismatches). When the on-chain indexer is
 * wired up, replace `AGENTS` with the indexer output — the `Agent` shape is
 * the contract.
 */
import type {
  Address,
  Agent,
  AgentMetrics,
  BadgeId,
  CategoryId,
  Currency,
  PricingTier,
  Protocol,
} from '@/lib/types';

/* ------------------------------ seeded rng ------------------------------ */

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex(rand: () => number, len: number) {
  const chars = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(rand() * 16)];
  return s;
}

function address(rand: () => number): Address {
  return `0x${hex(rand, 40)}` as Address;
}

function sparklineFor(rand: () => number, roi30d: number, drawdown: number, points = 30) {
  const target = 100 * (1 + roi30d / 100);
  const drift = (target - 100) / (points - 1);
  const vol = Math.max(0.15, drawdown / 4);
  const out: number[] = [100];
  for (let i = 1; i < points; i++) {
    const noise = (rand() - 0.5) * 2 * vol;
    const meanRevert = (100 + drift * i - out[i - 1]) * 0.35;
    out.push(+(out[i - 1] + drift + noise + meanRevert).toFixed(2));
  }
  out[points - 1] = +target.toFixed(2);
  return out;
}

/* ------------------------------ pricing --------------------------------- */

const TIER_FEATURES: Record<CategoryId, { task: string[]; week: string[]; month: string[] }> = {
  rebalancing: {
    task: ['One-off wallet or pool scan', 'Alert report delivered on-chain', 'A2A callback on completion'],
    week: ['Unlimited alerts for 7 days', 'Up to 25 tracked wallets / pools', 'Telegram + webhook delivery'],
    month: ['Everything in Weekly', 'Up to 250 tracked wallets / pools', 'Priority <500ms alert lane', 'Dedicated MCP endpoint'],
  },
  'grid-trading': {
    task: ['Single grid session (24h)', 'Up to 1 pair', 'Escrowed performance fee'],
    week: ['Continuous grid for 7 days', 'Up to 3 pairs', 'Auto-rebalance on range exit'],
    month: ['Everything in Weekly', 'Up to 10 pairs + arbitrage lane', 'Drawdown circuit breaker', 'Fractional revenue share eligible'],
  },
  'health-factor': {
    task: ['One-off position health audit', 'Liquidation risk report', 'Repay recommendation'],
    week: ['24/7 health-factor watch for 7 days', 'Auto-repay via scoped permission', 'Up to 3 positions'],
    month: ['Everything in Weekly', 'Up to 15 positions across Venus + Lista', 'Collateral auto-rebalance', 'Priority execution lane'],
  },
  yield: {
    task: ['One-off yield route plan', 'Net APY comparison across pools', 'Gas-aware execution plan'],
    week: ['Managed routing for 7 days', 'Daily rebalance', 'Up to $25k managed'],
    month: ['Everything in Weekly', 'Hourly rebalance', 'Up to $250k managed', 'Auto-compound + reporting'],
  },
};

function tiers(category: CategoryId, prices: { task: number; week: number; month: number }, currency: Currency = 'BNB'): PricingTier[] {
  const f = TIER_FEATURES[category];
  return [
    { id: 'task', name: 'Single Task', price: prices.task, currency, period: 'task', description: 'Pay per execution. Ideal for A2A calls.', features: f.task },
    { id: 'weekly', name: 'Weekly', price: prices.week, currency, period: 'week', description: 'Continuous service for 7 days, SLA-backed.', features: f.week, recommended: true },
    { id: 'monthly', name: 'Monthly', price: prices.month, currency, period: 'month', description: 'Best value. Priority lane + full features.', features: f.month },
  ];
}

/* ------------------------------- seeds ---------------------------------- */

interface AgentSeed {
  id: string;
  tokenId: number;
  name: string;
  handle: string;
  tagline: string;
  description: string;
  category: CategoryId;
  badges: BadgeId[];
  protocols: Protocol[];
  capabilities: string[];
  pricing: PricingTier[];
  roi7d: number;
  roi30d: number;
  maxDrawdown: number;
  winRate: number;
  slaScore: number;
  uptime: number;
  totalHires: number;
  activeHires: number;
  avgResponseMs: number;
  tvlManaged: number;
  volume7d: number;
  headline: { label: string; value: string };
  repScore: number;
  reviews: number;
  validations: number;
  registeredAt: string;
  gradient: string;
  initials: string;
  featured?: boolean;
  fractional?: { tokenSymbol: string; supply: number; holders: number; revenueShare: number; apr: number; sharePriceBnb: number };
  mcp?: boolean;
  tasks: string[];
}

const SEEDS: AgentSeed[] = [
  /* ----------------------------- Monitoring ----------------------------- */
  {
    id: 'whalewatch-bsc',
    tokenId: 8841,
    name: 'WhaleWatch BSC',
    handle: '@whalewatch',
    tagline: 'Sub-second whale wallet & liquidity alerts on BSC.',
    description:
      'WhaleWatch tracks the top 2,000 BSC wallets and every PancakeSwap v3 pool above $1M TVL. It fires alerts on large transfers, LP adds/removes and CEX inflows within 400ms of block inclusion, and can call back your agent via A2A with a structured event payload.',
    category: 'rebalancing',
    badges: ['erc8004-verified', 'validated', 'a2a-ready', 'mcp-enabled', 'top-rated'],
    protocols: ['PancakeSwap', 'Binance Oracle', 'opBNB'],
    capabilities: ['Whale transfer alerts', 'LP add/remove detection', 'CEX inflow/outflow tagging', 'Webhook + A2A callbacks', 'Custom wallet lists'],
    pricing: tiers('rebalancing', { task: 0.01, week: 0.06, month: 0.2 }),
    roi7d: 0, roi30d: 0, maxDrawdown: 0, winRate: 99.1, slaScore: 99.2, uptime: 99.98,
    totalHires: 4120, activeHires: 318, avgResponseMs: 412, tvlManaged: 0, volume7d: 0,
    headline: { label: 'Alert latency', value: '412 ms' },
    repScore: 97, reviews: 1284, validations: 62, registeredAt: '2026-01-18T09:12:00Z',
    gradient: 'from-cyan-400 to-blue-600', initials: 'WW', featured: true, mcp: true,
    tasks: ['watch_wallets', 'watch_pool', 'scan_transfers'],
  },
  {
    id: 'liquiditypulse',
    tokenId: 12093,
    name: 'LiquidityPulse',
    handle: '@liqpulse',
    tagline: 'Live PancakeSwap v3 liquidity migration radar.',
    description:
      'LiquidityPulse monitors concentrated-liquidity positions across PancakeSwap v3 and Thena, alerting on range migrations, liquidity cliffs and thin-book conditions before slippage spikes.',
    category: 'rebalancing',
    badges: ['erc8004-verified', 'a2a-ready', 'validated'],
    protocols: ['PancakeSwap', 'Thena'],
    capabilities: ['Range migration alerts', 'Liquidity cliff detection', 'Slippage forecasting', 'Pool depth snapshots'],
    pricing: tiers('rebalancing', { task: 0.008, week: 0.05, month: 0.16 }),
    roi7d: 0, roi30d: 0, maxDrawdown: 0, winRate: 97.8, slaScore: 98.1, uptime: 99.9,
    totalHires: 1873, activeHires: 142, avgResponseMs: 640, tvlManaged: 0, volume7d: 0,
    headline: { label: 'Alert latency', value: '640 ms' },
    repScore: 92, reviews: 512, validations: 31, registeredAt: '2026-02-03T14:40:00Z',
    gradient: 'from-sky-400 to-cyan-600', initials: 'LP',
    tasks: ['watch_pool', 'depth_snapshot'],
  },
  {
    id: 'rugradar',
    tokenId: 15522,
    name: 'RugRadar',
    handle: '@rugradar',
    tagline: 'New-token honeypot & rug-pull risk scanner.',
    description:
      'RugRadar simulates buys and sells on every new BSC token launch, checks ownership renouncement, hidden mint functions, tax traps and LP lock status, and scores each contract in under a second.',
    category: 'rebalancing',
    badges: ['erc8004-verified', 'validated', 'a2a-ready', 'mcp-enabled'],
    protocols: ['PancakeSwap', 'Binance Oracle'],
    capabilities: ['Honeypot simulation', 'Tax trap detection', 'LP lock verification', 'Owner privilege audit', 'Deployer reputation'],
    pricing: tiers('rebalancing', { task: 0.005, week: 0.04, month: 0.12 }),
    roi7d: 0, roi30d: 0, maxDrawdown: 0, winRate: 98.6, slaScore: 97.4, uptime: 99.95,
    totalHires: 6250, activeHires: 401, avgResponseMs: 880, tvlManaged: 0, volume7d: 0,
    headline: { label: 'Scan latency', value: '880 ms' },
    repScore: 94, reviews: 2210, validations: 48, registeredAt: '2025-12-11T08:00:00Z',
    gradient: 'from-teal-400 to-cyan-700', initials: 'RR', mcp: true,
    tasks: ['scan_token', 'simulate_trade'],
  },
  {
    id: 'oraclesentinel',
    tokenId: 19077,
    name: 'OracleSentinel',
    handle: '@oraclesentinel',
    tagline: 'Price-feed deviation & stale-oracle watchdog.',
    description:
      'OracleSentinel compares Binance Oracle and Chainlink feeds against PancakeSwap TWAPs and flags deviations, staleness and manipulation attempts that could trigger bad liquidations on Venus.',
    category: 'rebalancing',
    badges: ['erc8004-verified', 'a2a-ready'],
    protocols: ['Binance Oracle', 'Chainlink', 'Venus', 'PancakeSwap'],
    capabilities: ['Feed deviation alerts', 'Staleness detection', 'TWAP vs oracle comparison', 'Manipulation heuristics'],
    pricing: tiers('rebalancing', { task: 0.006, week: 0.045, month: 0.14 }),
    roi7d: 0, roi30d: 0, maxDrawdown: 0, winRate: 96.9, slaScore: 96.3, uptime: 99.87,
    totalHires: 940, activeHires: 88, avgResponseMs: 520, tvlManaged: 0, volume7d: 0,
    headline: { label: 'Alert latency', value: '520 ms' },
    repScore: 89, reviews: 236, validations: 19, registeredAt: '2026-03-22T11:05:00Z',
    gradient: 'from-cyan-500 to-indigo-600', initials: 'OS',
    tasks: ['watch_feed', 'compare_twap'],
  },
  {
    id: 'mempoolhawk',
    tokenId: 21460,
    name: 'MempoolHawk',
    handle: '@mempoolhawk',
    tagline: 'Pending-transaction radar for large swaps & MEV.',
    description:
      'MempoolHawk watches the BSC mempool for large pending swaps, sandwich setups and liquidation bots, giving your agents a head start before the next block lands.',
    category: 'rebalancing',
    badges: ['erc8004-verified', 'a2a-ready', 'mcp-enabled'],
    protocols: ['PancakeSwap', 'opBNB'],
    capabilities: ['Large pending swap alerts', 'Sandwich detection', 'Liquidation bot tracking', 'Gas spike alerts'],
    pricing: tiers('rebalancing', { task: 0.012, week: 0.08, month: 0.26 }),
    roi7d: 0, roi30d: 0, maxDrawdown: 0, winRate: 95.4, slaScore: 95.8, uptime: 99.7,
    totalHires: 730, activeHires: 96, avgResponseMs: 290, tvlManaged: 0, volume7d: 0,
    headline: { label: 'Alert latency', value: '290 ms' },
    repScore: 87, reviews: 198, validations: 12, registeredAt: '2026-04-09T16:30:00Z',
    gradient: 'from-blue-400 to-cyan-500', initials: 'MH', mcp: true,
    tasks: ['watch_mempool', 'detect_sandwich'],
  },

  /* ---------------------------- Grid Trading ---------------------------- */
  {
    id: 'gridforge-pro',
    tokenId: 3021,
    name: 'GridForge Pro',
    handle: '@gridforge',
    tagline: 'Adaptive PancakeSwap v3 grid bot for BNB/USDT.',
    description:
      'GridForge runs volatility-adaptive grids on PancakeSwap v3 with automatic range re-centering, fee harvesting and a hard drawdown circuit breaker. Every fill is verifiable on-chain and streamed to your dashboard.',
    category: 'grid-trading',
    badges: ['erc8004-verified', 'validated', 'pancakeswap-top-trader', 'a2a-ready', 'fractional', 'top-rated'],
    protocols: ['PancakeSwap', 'Binance Oracle'],
    capabilities: ['Volatility-adaptive grid spacing', 'Auto range re-centering', 'Fee harvesting', 'Drawdown circuit breaker', 'Multi-pair (BNB, ETH, BTCB)'],
    pricing: tiers('grid-trading', { task: 0.05, week: 0.25, month: 0.8 }),
    roi7d: 4.82, roi30d: 17.6, maxDrawdown: 3.1, winRate: 71.4, slaScore: 98.7, uptime: 99.95,
    totalHires: 2688, activeHires: 412, avgResponseMs: 1400, tvlManaged: 4_820_000, volume7d: 38_400_000,
    headline: { label: '7-day ROI', value: '+4.82%' },
    repScore: 96, reviews: 941, validations: 57, registeredAt: '2025-11-02T10:00:00Z',
    gradient: 'from-amber-300 to-yellow-600', initials: 'GF', featured: true,
    fractional: { tokenSymbol: 'gFORGE', supply: 100_000, holders: 1_842, revenueShare: 20, apr: 31.4, sharePriceBnb: 0.012 },
    tasks: ['start_grid', 'stop_grid', 'rebalance'],
  },
  {
    id: 'cakearb',
    tokenId: 5410,
    name: 'CakeArb',
    handle: '@cakearb',
    tagline: 'Cross-DEX arbitrage between PancakeSwap and Thena.',
    description:
      'CakeArb captures price dislocations across PancakeSwap v2/v3, Thena and Wombat with atomic multi-hop routes. Zero-loss execution: trades revert if the spread closes before inclusion.',
    category: 'grid-trading',
    badges: ['erc8004-verified', 'pancakeswap-top-trader', 'a2a-ready', 'validated'],
    protocols: ['PancakeSwap', 'Thena', 'Wombat'],
    capabilities: ['Atomic multi-hop arbitrage', 'Revert-on-loss execution', 'Gas-aware routing', 'Flash-loan sourcing'],
    pricing: tiers('grid-trading', { task: 0.04, week: 0.2, month: 0.65 }),
    roi7d: 2.91, roi30d: 11.2, maxDrawdown: 0.8, winRate: 93.8, slaScore: 97.9, uptime: 99.9,
    totalHires: 1510, activeHires: 233, avgResponseMs: 950, tvlManaged: 2_150_000, volume7d: 61_200_000,
    headline: { label: '7-day ROI', value: '+2.91%' },
    repScore: 93, reviews: 604, validations: 40, registeredAt: '2026-01-05T12:20:00Z',
    gradient: 'from-yellow-400 to-orange-600', initials: 'CA', featured: true,
    tasks: ['run_arb', 'scan_spreads'],
  },
  {
    id: 'rangerider',
    tokenId: 7788,
    name: 'RangeRider',
    handle: '@rangerider',
    tagline: 'Concentrated-liquidity range manager for PancakeSwap v3.',
    description:
      'RangeRider keeps your PancakeSwap v3 LP positions in range, compounding fees and shifting ranges based on realized volatility so your capital never sits idle.',
    category: 'grid-trading',
    badges: ['erc8004-verified', 'a2a-ready', 'fractional'],
    protocols: ['PancakeSwap'],
    capabilities: ['Range tracking & shifting', 'Fee auto-compounding', 'IL-aware rebalancing', 'Position health reports'],
    pricing: tiers('grid-trading', { task: 0.03, week: 0.15, month: 0.5 }),
    roi7d: 1.74, roi30d: 7.9, maxDrawdown: 2.4, winRate: 66.2, slaScore: 96.5, uptime: 99.8,
    totalHires: 872, activeHires: 154, avgResponseMs: 2100, tvlManaged: 1_380_000, volume7d: 9_700_000,
    headline: { label: '7-day ROI', value: '+1.74%' },
    repScore: 90, reviews: 318, validations: 22, registeredAt: '2026-02-14T09:45:00Z',
    gradient: 'from-amber-400 to-rose-500', initials: 'RR',
    fractional: { tokenSymbol: 'gRIDE', supply: 50_000, holders: 412, revenueShare: 15, apr: 18.2, sharePriceBnb: 0.008 },
    tasks: ['manage_range', 'compound_fees'],
  },
  {
    id: 'momentummesh',
    tokenId: 9934,
    name: 'MomentumMesh',
    handle: '@momentummesh',
    tagline: 'Trend-following grid with regime detection.',
    description:
      'MomentumMesh switches between mean-reversion grids and breakout trailing modes based on on-chain regime signals, trading BNB, ETH and BTCB majors on PancakeSwap.',
    category: 'grid-trading',
    badges: ['erc8004-verified', 'a2a-ready'],
    protocols: ['PancakeSwap', 'Binance Oracle'],
    capabilities: ['Regime detection', 'Trailing breakout mode', 'Mean-reversion grid', 'Risk-parity sizing'],
    pricing: tiers('grid-trading', { task: 0.045, week: 0.22, month: 0.7 }),
    roi7d: 6.35, roi30d: 22.8, maxDrawdown: 7.9, winRate: 58.1, slaScore: 94.2, uptime: 99.6,
    totalHires: 640, activeHires: 121, avgResponseMs: 1800, tvlManaged: 920_000, volume7d: 14_100_000,
    headline: { label: '7-day ROI', value: '+6.35%' },
    repScore: 84, reviews: 205, validations: 14, registeredAt: '2026-03-30T18:15:00Z',
    gradient: 'from-orange-400 to-amber-600', initials: 'MM',
    tasks: ['start_strategy', 'stop_strategy'],
  },
  {
    id: 'stablegrid',
    tokenId: 11208,
    name: 'StableGrid',
    handle: '@stablegrid',
    tagline: 'Low-risk micro-grid on stablecoin pairs.',
    description:
      'StableGrid runs tight grids on USDT/USDC/FDUSD pairs, harvesting peg oscillations with minimal drawdown. Built for treasuries and agents that need predictable yield.',
    category: 'grid-trading',
    badges: ['erc8004-verified', 'validated', 'a2a-ready', 'mcp-enabled'],
    protocols: ['PancakeSwap', 'Wombat'],
    capabilities: ['Stable-pair micro grids', 'Peg deviation capture', 'Ultra-low drawdown', 'Treasury reporting'],
    pricing: tiers('grid-trading', { task: 0.02, week: 0.1, month: 0.32 }, 'USDT'),
    roi7d: 0.42, roi30d: 1.85, maxDrawdown: 0.12, winRate: 88.9, slaScore: 99.1, uptime: 99.97,
    totalHires: 1980, activeHires: 377, avgResponseMs: 1100, tvlManaged: 7_640_000, volume7d: 22_900_000,
    headline: { label: '7-day ROI', value: '+0.42%' },
    repScore: 95, reviews: 722, validations: 45, registeredAt: '2025-12-20T07:30:00Z',
    gradient: 'from-lime-300 to-yellow-500', initials: 'SG', mcp: true,
    tasks: ['start_grid', 'report'],
  },

  /* ---------------------------- Health Factor --------------------------- */
  {
    id: 'venusguardian',
    tokenId: 2210,
    name: 'VenusGuardian',
    handle: '@venusguardian',
    tagline: 'Venus health-factor watch with auto-repay.',
    description:
      'VenusGuardian monitors your Venus Protocol positions every block and, using an Altana scoped permission, repays or adds collateral the moment your health factor approaches your threshold. 99.6% liquidation prevention over 30 days.',
    category: 'health-factor',
    badges: ['erc8004-verified', 'validated', 'venus-risk-monitor', 'a2a-ready', 'mcp-enabled', 'top-rated'],
    protocols: ['Venus', 'Binance Oracle', 'PancakeSwap'],
    capabilities: ['Per-block health-factor monitoring', 'Auto-repay via scoped permission', 'Collateral top-up', 'Liquidation forecast', 'Multi-position support'],
    pricing: tiers('health-factor', { task: 0.015, week: 0.09, month: 0.3 }),
    roi7d: 0, roi30d: 0, maxDrawdown: 0, winRate: 99.6, slaScore: 99.4, uptime: 99.99,
    totalHires: 3312, activeHires: 690, avgResponseMs: 780, tvlManaged: 18_400_000, volume7d: 3_100_000,
    headline: { label: 'Liquidation prevention', value: '99.6%' },
    repScore: 98, reviews: 1120, validations: 71, registeredAt: '2025-10-15T08:00:00Z',
    gradient: 'from-emerald-400 to-teal-600', initials: 'VG', featured: true, mcp: true,
    tasks: ['watch_position', 'repay', 'add_collateral'],
  },
  {
    id: 'liquidationshield',
    tokenId: 6675,
    name: 'LiquidationShield',
    handle: '@liqshield',
    tagline: 'Multi-protocol collateral rebalancer (Venus + Lista).',
    description:
      'LiquidationShield protects positions across Venus and Lista DAO simultaneously, rebalancing collateral between protocols to keep every health factor above target at the lowest cost.',
    category: 'health-factor',
    badges: ['erc8004-verified', 'venus-risk-monitor', 'a2a-ready', 'validated'],
    protocols: ['Venus', 'Lista DAO', 'PancakeSwap'],
    capabilities: ['Cross-protocol rebalancing', 'Cost-optimal repay path', 'Health-factor alerts', 'slisBNB collateral support'],
    pricing: tiers('health-factor', { task: 0.018, week: 0.1, month: 0.34 }),
    roi7d: 0, roi30d: 0, maxDrawdown: 0, winRate: 98.9, slaScore: 98.2, uptime: 99.95,
    totalHires: 1440, activeHires: 301, avgResponseMs: 1020, tvlManaged: 9_200_000, volume7d: 1_800_000,
    headline: { label: 'Liquidation prevention', value: '98.9%' },
    repScore: 93, reviews: 487, validations: 36, registeredAt: '2026-01-27T13:10:00Z',
    gradient: 'from-green-400 to-emerald-700', initials: 'LS',
    tasks: ['watch_position', 'rebalance'],
  },
  {
    id: 'collateralpilot',
    tokenId: 8412,
    name: 'CollateralPilot',
    handle: '@collateralpilot',
    tagline: 'LTV optimizer that keeps you safe and capital-efficient.',
    description:
      'CollateralPilot targets an optimal loan-to-value band on Venus, borrowing more when safe and deleveraging when volatility rises, so you earn more without ever getting close to liquidation.',
    category: 'health-factor',
    badges: ['erc8004-verified', 'venus-risk-monitor', 'a2a-ready'],
    protocols: ['Venus', 'Binance Oracle'],
    capabilities: ['LTV band targeting', 'Volatility-aware deleveraging', 'Borrow capacity optimization', 'Weekly risk report'],
    pricing: tiers('health-factor', { task: 0.02, week: 0.11, month: 0.36 }),
    roi7d: 0.31, roi30d: 1.4, maxDrawdown: 0.6, winRate: 97.2, slaScore: 96.8, uptime: 99.9,
    totalHires: 690, activeHires: 148, avgResponseMs: 1350, tvlManaged: 5_600_000, volume7d: 2_400_000,
    headline: { label: 'Liquidation prevention', value: '97.2%' },
    repScore: 90, reviews: 244, validations: 20, registeredAt: '2026-03-08T10:25:00Z',
    gradient: 'from-teal-300 to-green-600', initials: 'CP',
    tasks: ['optimize_ltv', 'deleverage'],
  },
  {
    id: 'debtsweeper',
    tokenId: 13350,
    name: 'DebtSweeper',
    handle: '@debtsweeper',
    tagline: 'Emergency repay bot for sudden market drops.',
    description:
      'DebtSweeper is a lightweight last-line-of-defense agent: it does nothing until your health factor crosses a hard threshold, then repays from a pre-approved stablecoin reserve within one block.',
    category: 'health-factor',
    badges: ['erc8004-verified', 'a2a-ready', 'mcp-enabled'],
    protocols: ['Venus', 'Lista DAO'],
    capabilities: ['Hard-threshold emergency repay', 'Single-block execution', 'Stablecoin reserve management', 'Zero idle cost'],
    pricing: tiers('health-factor', { task: 0.01, week: 0.05, month: 0.15 }),
    roi7d: 0, roi30d: 0, maxDrawdown: 0, winRate: 96.4, slaScore: 97.6, uptime: 99.93,
    totalHires: 1120, activeHires: 264, avgResponseMs: 610, tvlManaged: 3_900_000, volume7d: 640_000,
    headline: { label: 'Liquidation prevention', value: '96.4%' },
    repScore: 88, reviews: 356, validations: 17, registeredAt: '2026-04-21T15:50:00Z',
    gradient: 'from-emerald-500 to-cyan-600', initials: 'DS', mcp: true,
    tasks: ['arm', 'disarm', 'repay'],
  },

  /* -------------------------------- Yield ------------------------------- */
  {
    id: 'yieldrouter',
    tokenId: 1502,
    name: 'YieldRouter',
    handle: '@yieldrouter',
    tagline: 'Routes capital to the best net APY across BSC.',
    description:
      'YieldRouter continuously scores every major BSC yield venue — Venus, Lista, PancakeSwap farms, Alpaca and Wombat — on net APY after gas and risk, then rebalances your capital hourly. Fully transparent, every move on-chain.',
    category: 'yield',
    badges: ['erc8004-verified', 'validated', 'a2a-ready', 'mcp-enabled', 'fractional', 'top-rated'],
    protocols: ['Venus', 'Lista DAO', 'PancakeSwap', 'Alpaca Finance', 'Wombat'],
    capabilities: ['Net-APY scoring after gas', 'Hourly rebalancing', 'Risk-adjusted allocation', 'Auto-compounding', 'Treasury reporting'],
    pricing: tiers('yield', { task: 0.02, week: 0.12, month: 0.4 }),
    roi7d: 0.38, roi30d: 1.62, maxDrawdown: 0.3, winRate: 82.5, slaScore: 98.9, uptime: 99.97,
    totalHires: 2940, activeHires: 561, avgResponseMs: 2400, tvlManaged: 26_800_000, volume7d: 8_900_000,
    headline: { label: 'Net APY', value: '19.4%' },
    repScore: 97, reviews: 1018, validations: 66, registeredAt: '2025-11-20T09:00:00Z',
    gradient: 'from-violet-400 to-fuchsia-600', initials: 'YR', featured: true, mcp: true,
    fractional: { tokenSymbol: 'yROUTE', supply: 250_000, holders: 3_210, revenueShare: 25, apr: 27.9, sharePriceBnb: 0.006 },
    tasks: ['route_capital', 'rebalance', 'report'],
  },
  {
    id: 'alpacaharvester',
    tokenId: 4477,
    name: 'AlpacaHarvester',
    handle: '@alpacaharvester',
    tagline: 'Leveraged yield-farming manager with auto-deleverage.',
    description:
      'AlpacaHarvester manages leveraged farming positions on Alpaca Finance, harvesting rewards daily and automatically reducing leverage when the debt ratio approaches the kill buffer.',
    category: 'yield',
    badges: ['erc8004-verified', 'a2a-ready', 'validated'],
    protocols: ['Alpaca Finance', 'PancakeSwap'],
    capabilities: ['Leveraged position management', 'Daily reward harvesting', 'Auto-deleverage', 'Debt-ratio alerts'],
    pricing: tiers('yield', { task: 0.025, week: 0.14, month: 0.45 }),
    roi7d: 0.61, roi30d: 2.7, maxDrawdown: 1.9, winRate: 74.3, slaScore: 95.7, uptime: 99.8,
    totalHires: 810, activeHires: 172, avgResponseMs: 3100, tvlManaged: 6_100_000, volume7d: 4_300_000,
    headline: { label: 'Net APY', value: '32.4%' },
    repScore: 88, reviews: 297, validations: 21, registeredAt: '2026-02-19T11:40:00Z',
    gradient: 'from-purple-400 to-violet-700', initials: 'AH',
    tasks: ['open_position', 'harvest', 'deleverage'],
  },
  {
    id: 'listamaxx',
    tokenId: 10110,
    name: 'ListaMaxx',
    handle: '@listamaxx',
    tagline: 'slisBNB & lisUSD liquid-staking yield optimizer.',
    description:
      'ListaMaxx loops slisBNB liquid staking with lisUSD borrowing on Lista DAO, capturing staking yield plus LP incentives while keeping collateral ratios conservative.',
    category: 'yield',
    badges: ['erc8004-verified', 'a2a-ready', 'fractional'],
    protocols: ['Lista DAO', 'PancakeSwap'],
    capabilities: ['slisBNB looping', 'lisUSD LP incentives', 'Collateral ratio guard', 'Reward auto-claim'],
    pricing: tiers('yield', { task: 0.02, week: 0.11, month: 0.36 }),
    roi7d: 0.45, roi30d: 1.98, maxDrawdown: 0.7, winRate: 79.6, slaScore: 97.1, uptime: 99.9,
    totalHires: 1230, activeHires: 289, avgResponseMs: 2700, tvlManaged: 11_300_000, volume7d: 3_700_000,
    headline: { label: 'Net APY', value: '23.8%' },
    repScore: 91, reviews: 402, validations: 28, registeredAt: '2026-01-12T10:10:00Z',
    gradient: 'from-fuchsia-400 to-purple-700', initials: 'LM',
    fractional: { tokenSymbol: 'yLISTA', supply: 80_000, holders: 964, revenueShare: 18, apr: 22.1, sharePriceBnb: 0.007 },
    tasks: ['loop', 'unwind', 'claim'],
  },
  {
    id: 'cakecompounder',
    tokenId: 14205,
    name: 'CakeCompounder',
    handle: '@cakecompounder',
    tagline: 'Gas-optimal CAKE staking & farm auto-compounder.',
    description:
      'CakeCompounder claims and re-stakes CAKE rewards across PancakeSwap farms and the veCAKE pool at the gas-optimal cadence, boosting effective APY without you lifting a finger.',
    category: 'yield',
    badges: ['erc8004-verified', 'validated', 'a2a-ready', 'mcp-enabled'],
    protocols: ['PancakeSwap'],
    capabilities: ['Gas-optimal compounding cadence', 'veCAKE boost management', 'Multi-farm support', 'Reward analytics'],
    pricing: tiers('yield', { task: 0.008, week: 0.05, month: 0.16 }),
    roi7d: 0.52, roi30d: 2.3, maxDrawdown: 0.4, winRate: 91.2, slaScore: 98.4, uptime: 99.96,
    totalHires: 3570, activeHires: 812, avgResponseMs: 1900, tvlManaged: 14_700_000, volume7d: 2_100_000,
    headline: { label: 'Net APY', value: '27.6%' },
    repScore: 94, reviews: 1305, validations: 39, registeredAt: '2025-12-02T09:30:00Z',
    gradient: 'from-violet-300 to-indigo-600', initials: 'CC', mcp: true,
    tasks: ['compound', 'report'],
  },
  {
    id: 'stableyield-optimizer',
    tokenId: 16890,
    name: 'StableYield Optimizer',
    handle: '@stableyield',
    tagline: 'Best stablecoin APY across BSC lending, risk-scored.',
    description:
      'StableYield moves USDT, USDC and FDUSD between Venus, Lista and Wombat to capture the highest risk-adjusted stable APY, with automatic exit on any depeg or utilization spike.',
    category: 'yield',
    badges: ['erc8004-verified', 'a2a-ready', 'validated'],
    protocols: ['Venus', 'Lista DAO', 'Wombat'],
    capabilities: ['Stable APY routing', 'Depeg auto-exit', 'Utilization spike guard', 'Daily statements'],
    pricing: tiers('yield', { task: 0.012, week: 0.07, month: 0.24 }, 'USDT'),
    roi7d: 0.21, roi30d: 0.92, maxDrawdown: 0.08, winRate: 94.7, slaScore: 99.0, uptime: 99.98,
    totalHires: 2210, activeHires: 498, avgResponseMs: 2200, tvlManaged: 33_900_000, volume7d: 5_200_000,
    headline: { label: 'Net APY', value: '11.2%' },
    repScore: 95, reviews: 780, validations: 44, registeredAt: '2025-11-28T14:00:00Z',
    gradient: 'from-indigo-400 to-violet-600', initials: 'SY',
    tasks: ['route_stables', 'exit', 'report'],
  },
  {
    id: 'wombatwrangler',
    tokenId: 18334,
    name: 'WombatWrangler',
    handle: '@wombatwrangler',
    tagline: 'Wombat Exchange stable-LP and WOM boost optimizer.',
    description:
      'WombatWrangler allocates across Wombat stable pools, manages veWOM boosts and harvests bribes, tuned for treasuries that want stable yield with deep liquidity.',
    category: 'yield',
    badges: ['erc8004-verified', 'a2a-ready'],
    protocols: ['Wombat', 'PancakeSwap'],
    capabilities: ['Stable-pool allocation', 'veWOM boost management', 'Bribe harvesting', 'Coverage-ratio monitoring'],
    pricing: tiers('yield', { task: 0.01, week: 0.06, month: 0.2 }),
    roi7d: 0.27, roi30d: 1.15, maxDrawdown: 0.2, winRate: 86.8, slaScore: 96.2, uptime: 99.85,
    totalHires: 560, activeHires: 117, avgResponseMs: 2600, tvlManaged: 4_400_000, volume7d: 1_200_000,
    headline: { label: 'Net APY', value: '14.9%' },
    repScore: 86, reviews: 171, validations: 13, registeredAt: '2026-05-06T12:00:00Z',
    gradient: 'from-purple-500 to-pink-600', initials: 'WW',
    tasks: ['allocate', 'harvest'],
  },
];

/* ------------------------------ expansion ------------------------------- */

function expand(seed: AgentSeed): Agent {
  const rand = mulberry32(hashStr(seed.id));
  const owner = address(rand);
  const agentAddress = address(rand);
  const validators = Array.from({ length: 3 }, () => address(rand));
  const positive = Math.round(seed.reviews * (seed.repScore / 100));

  const metrics: AgentMetrics = {
    roi7d: seed.roi7d,
    roi30d: seed.roi30d,
    maxDrawdown: seed.maxDrawdown,
    winRate: seed.winRate,
    slaScore: seed.slaScore,
    uptime: seed.uptime,
    totalHires: seed.totalHires,
    activeHires: seed.activeHires,
    avgResponseMs: seed.avgResponseMs,
    tvlManaged: seed.tvlManaged,
    volume7d: seed.volume7d,
    headline: seed.headline,
  };

  // Monitoring/health agents have no PnL; give them a flat-ish "uptime" style curve instead
  const curveRoi = seed.roi30d !== 0 ? seed.roi30d : 0.6;
  const curveDd = seed.maxDrawdown !== 0 ? seed.maxDrawdown : 0.5;

  return {
    id: seed.id,
    tokenId: seed.tokenId,
    name: seed.name,
    handle: seed.handle,
    tagline: seed.tagline,
    description: seed.description,
    category: seed.category,
    owner,
    agentAddress,
    agentURI: `https://agents.bazar.bnb/${seed.id}/agent.json`,
    registeredAt: seed.registeredAt,
    verified: seed.badges.includes('erc8004-verified'),
    badges: seed.badges,
    protocols: seed.protocols,
    capabilities: seed.capabilities,
    metrics,
    reputation: {
      score: seed.repScore,
      reviews: seed.reviews,
      positiveFeedback: positive,
      negativeFeedback: seed.reviews - positive,
      validations: seed.validations,
      lastValidatedAt: new Date(Date.UTC(2026, 7, 20 + Math.floor(rand() * 7), Math.floor(rand() * 24))).toISOString(),
      validators,
    },
    pricing: seed.pricing,
    a2a: {
      enabled: seed.badges.includes('a2a-ready'),
      endpoint: `https://agents.bazar.bnb/${seed.id}/a2a`,
      mcp: !!seed.mcp,
      protocols: seed.mcp ? ['A2A/1.0', 'MCP/2025-06'] : ['A2A/1.0'],
      tasks: seed.tasks,
    },
    fractional: seed.fractional ? { enabled: true, ...seed.fractional } : undefined,
    sparkline: sparklineFor(rand, curveRoi, curveDd),
    avatar: { gradient: seed.gradient, initials: seed.initials },
    featured: seed.featured,
  };
}

export const AGENTS: Agent[] = SEEDS.map(expand);

/* ------------------------------- queries -------------------------------- */

export const AGENT_MAP: Record<string, Agent> = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

export function getAgent(idOrTokenId: string | number): Agent | undefined {
  if (typeof idOrTokenId === 'number' || /^\d+$/.test(String(idOrTokenId))) {
    const tid = Number(idOrTokenId);
    return AGENTS.find((a) => a.tokenId === tid);
  }
  return AGENT_MAP[String(idOrTokenId).toLowerCase()];
}

export function getAgentsByCategory(category: CategoryId): Agent[] {
  return AGENTS.filter((a) => a.category === category);
}

export function getFeaturedAgents(limit = 4): Agent[] {
  return AGENTS.filter((a) => a.featured).slice(0, limit);
}

export type SortKey = 'reputation' | 'roi7d' | 'sla' | 'hires' | 'price' | 'newest';

export interface AgentQuery {
  q?: string;
  category?: CategoryId | 'all';
  badges?: BadgeId[];
  protocols?: Protocol[];
  a2aOnly?: boolean;
  minSla?: number;
  sort?: SortKey;
}

export function queryAgents(query: AgentQuery = {}): Agent[] {
  const { q, category = 'all', badges = [], protocols = [], a2aOnly, minSla, sort = 'reputation' } = query;
  const needle = q?.trim().toLowerCase();

  let list = AGENTS.filter((a) => {
    if (category !== 'all' && a.category !== category) return false;
    if (a2aOnly && !a.a2a.enabled) return false;
    if (minSla !== undefined && a.metrics.slaScore < minSla) return false;
    if (badges.length && !badges.every((b) => a.badges.includes(b))) return false;
    if (protocols.length && !protocols.some((p) => a.protocols.includes(p))) return false;
    if (needle) {
      const hay = [a.name, a.handle, a.tagline, a.description, a.category, ...a.capabilities, ...a.protocols, String(a.tokenId)]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const weeklyPrice = (a: Agent) => a.pricing.find((t) => t.id === 'weekly')?.price ?? a.pricing[0]?.price ?? 0;

  list = [...list].sort((a, b) => {
    switch (sort) {
      case 'roi7d':
        return b.metrics.roi7d - a.metrics.roi7d;
      case 'sla':
        return b.metrics.slaScore - a.metrics.slaScore;
      case 'hires':
        return b.metrics.totalHires - a.metrics.totalHires;
      case 'price':
        return weeklyPrice(a) - weeklyPrice(b);
      case 'newest':
        return new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime();
      case 'reputation':
      default:
        return b.reputation.score - a.reputation.score;
    }
  });

  return list;
}

export const ALL_PROTOCOLS: Protocol[] = Array.from(new Set(AGENTS.flatMap((a) => a.protocols))).sort() as Protocol[];
