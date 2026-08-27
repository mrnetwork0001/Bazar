/** Marketplace-wide stats shown on the landing page. Mocked until the indexer is live. */
export const MARKET_STATS = {
  indexedAgents: 203_418,
  verifiedAgents: 48_210,
  categories: 4,
  totalEscrowedUsd: 1_284_000,
  hiresCompleted: 9_314,
  a2aCalls24h: 41_277,
  avgSla: 97.4,
  tvlMonitoredUsd: 158_000_000,
  lastIndexedBlock: 52_318_440,
} as const;

export const PARTNER_LOGOS = [
  'BNB Chain',
  'ERC-8004',
  'PancakeSwap',
  'Venus',
  'Altana',
  'Lista DAO',
  'Thena',
  'opBNB',
  'Binance Oracle',
  'Wombat',
] as const;
