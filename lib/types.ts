/**
 * Bazar core domain types.
 *
 * These mirror what the ERC-8004 indexer will surface once it is wired to BSC:
 *   - Identity Registry  -> Agent identity NFT (tokenId, owner, agentURI)
 *   - Reputation Registry -> Reputation (score, feedback, reviews)
 *   - Validation Registry -> validations (validators, last validated)
 * Until then, `lib/data/agents.ts` provides deterministic seeded mock data.
 */

export type Address = `0x${string}`;

export type CategoryId = 'monitoring' | 'grid-trading' | 'health-factor' | 'yield';

export interface Category {
  id: CategoryId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  agentType: string;
  primaryAction: string;
  keyMetric: string;
  keyMetricKey: keyof AgentMetrics;
  /** lucide-react icon name, e.g. "Radar" */
  icon: 'Radar' | 'Grid3x3' | 'HeartPulse' | 'TrendingUp';
  /** Tailwind color key under `cat.*` and hex value for inline styles */
  accent: 'monitoring' | 'grid' | 'health' | 'yield';
  accentHex: string;
}

export type BadgeId =
  | 'erc8004-verified'
  | 'validated'
  | 'pancakeswap-top-trader'
  | 'venus-risk-monitor'
  | 'a2a-ready'
  | 'mcp-enabled'
  | 'fractional'
  | 'top-rated';

export type Protocol =
  | 'PancakeSwap'
  | 'Venus'
  | 'Lista DAO'
  | 'Thena'
  | 'Alpaca Finance'
  | 'Wombat'
  | 'Binance Oracle'
  | 'Chainlink'
  | 'opBNB';

export type Currency = 'BNB' | 'USDT';
export type BillingPeriod = 'task' | 'day' | 'week' | 'month';

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  currency: Currency;
  period: BillingPeriod;
  description: string;
  features: string[];
  recommended?: boolean;
}

export interface AgentMetrics {
  /** 7-day ROI in percent (e.g. 4.2 = +4.2%) */
  roi7d: number;
  /** 30-day ROI in percent */
  roi30d: number;
  /** Max drawdown in percent, positive number (e.g. 3.1 = -3.1%) */
  maxDrawdown: number;
  /** Win rate in percent */
  winRate: number;
  /** SLA adherence score 0-100 */
  slaScore: number;
  /** Uptime percent */
  uptime: number;
  totalHires: number;
  activeHires: number;
  /** Average response latency in ms */
  avgResponseMs: number;
  /** USD value managed / monitored by the agent */
  tvlManaged: number;
  /** 7-day executed volume in USD */
  volume7d: number;
  /** Category-specific headline metric (e.g. alert latency, liquidation prevention rate, net APY) */
  headline: { label: string; value: string };
}

export interface Reputation {
  /** ERC-8004 Reputation Registry aggregate score 0-100 */
  score: number;
  reviews: number;
  positiveFeedback: number;
  negativeFeedback: number;
  /** ERC-8004 Validation Registry count */
  validations: number;
  lastValidatedAt: string;
  validators: Address[];
}

export interface A2AConfig {
  enabled: boolean;
  /** Public A2A endpoint for the agent */
  endpoint: string;
  mcp: boolean;
  protocols: string[];
  /** Supported task types for programmatic hiring */
  tasks: string[];
}

export interface FractionalOffer {
  enabled: boolean;
  tokenSymbol: string;
  supply: number;
  holders: number;
  /** Percent of agent revenue shared with token holders */
  revenueShare: number;
  /** Estimated APR for holders, percent */
  apr: number;
  /** Price per share token in BNB */
  sharePriceBnb: number;
}

export interface Agent {
  /** URL slug, e.g. "whalewatch-bsc" */
  id: string;
  /** ERC-8004 Identity NFT token id */
  tokenId: number;
  name: string;
  /** e.g. "@whalewatch" */
  handle: string;
  tagline: string;
  description: string;
  category: CategoryId;
  owner: Address;
  /** Address the agent operates from */
  agentAddress: Address;
  /** ERC-8004 agentURI (agent card) */
  agentURI: string;
  registeredAt: string;
  verified: boolean;
  badges: BadgeId[];
  protocols: Protocol[];
  capabilities: string[];
  metrics: AgentMetrics;
  reputation: Reputation;
  pricing: PricingTier[];
  a2a: A2AConfig;
  fractional?: FractionalOffer;
  /** 30 daily equity-curve points, base 100 */
  sparkline: number[];
  avatar: {
    /** Tailwind gradient classes, e.g. "from-cyan-400 to-blue-600" */
    gradient: string;
    initials: string;
  };
  featured?: boolean;
}

export type HireStatus =
  | 'pending'
  | 'escrowed'
  | 'active'
  | 'sla-check'
  | 'released'
  | 'refunded'
  | 'disputed';

export interface Hire {
  id: string;
  agentId: string;
  tierId: string;
  hirer: Address;
  amount: number;
  currency: Currency;
  status: HireStatus;
  /** 0-100 progress against the SLA */
  slaProgress: number;
  source: 'human' | 'a2a';
  createdAt: string;
  expiresAt: string;
  escrowTx?: Address;
  releaseTx?: Address;
  /** For A2A hires: the calling agent id/address */
  callerAgent?: string;
  task?: string;
}

/* ------------------------------------------------------------------ */
/* A2A router API contract (/api/v1/a2a/*)                            */
/* ------------------------------------------------------------------ */

export interface A2AHireRequest {
  /** Bazar agent id (slug) or ERC-8004 tokenId */
  agentId: string | number;
  tierId: string;
  /** Address paying into escrow (the calling agent's wallet) */
  payer: Address;
  currency?: Currency;
  /** Optional task description passed to the hired agent */
  task?: string;
  /** Optional caller agent identity (ERC-8004 tokenId or slug) */
  callerAgentId?: string | number;
  /** Optional SLA overrides */
  sla?: {
    /** Max acceptable latency in ms */
    maxLatencyMs?: number;
    /** Minimum uptime percent */
    minUptime?: number;
    /** Deadline ISO timestamp */
    deadline?: string;
  };
  /** Webhook URL to be notified on escrow events */
  callbackUrl?: string;
}

export interface A2AHireResponse {
  ok: true;
  hire: Hire;
  escrow: {
    contract: Address;
    chainId: number;
    amount: number;
    currency: Currency;
    /** Calldata the caller signs & submits to lock funds */
    calldata: Address;
    /** Expiry of the quote */
    validUntil: string;
  };
  agent: {
    id: string;
    tokenId: number;
    name: string;
    endpoint: string;
  };
}

export interface A2AErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
