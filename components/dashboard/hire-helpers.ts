import type { Agent, Category, Hire, HireStatus, PricingTier } from '@/lib/types';
import { getAgent } from '@/lib/data/agents';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { isAddress, shortAddress } from '@/lib/utils';

/* -------------------------------- tabs --------------------------------- */

export type DashboardTab = 'all' | 'active' | 'sla-check' | 'completed' | 'a2a';

export const DASHBOARD_TABS: ReadonlyArray<{ id: DashboardTab; label: string; hint: string }> = [
  { id: 'all', label: 'All', hint: 'Every hire on this wallet' },
  { id: 'active', label: 'Active', hint: 'Escrowed and executing under SLA' },
  { id: 'sla-check', label: 'SLA check', hint: 'Awaiting SLA verification' },
  { id: 'completed', label: 'Completed', hint: 'Released to the agent or refunded' },
  { id: 'a2a', label: 'A2A', hint: 'Placed programmatically by other agents' },
];

const OPEN_STATUSES: ReadonlySet<HireStatus> = new Set<HireStatus>(['pending', 'escrowed', 'active', 'disputed']);
const SETTLED_STATUSES: ReadonlySet<HireStatus> = new Set<HireStatus>(['released', 'refunded']);
const IN_FLIGHT_STATUSES: ReadonlySet<HireStatus> = new Set<HireStatus>(['escrowed', 'active', 'sla-check']);

export function matchesTab(hire: Hire, tab: DashboardTab): boolean {
  switch (tab) {
    case 'active':
      return OPEN_STATUSES.has(hire.status);
    case 'sla-check':
      return hire.status === 'sla-check';
    case 'completed':
      return SETTLED_STATUSES.has(hire.status);
    case 'a2a':
      return hire.source === 'a2a';
    case 'all':
    default:
      return true;
  }
}

export function countByTab(hires: Hire[]): Record<DashboardTab, number> {
  const counts: Record<DashboardTab, number> = { all: 0, active: 0, 'sla-check': 0, completed: 0, a2a: 0 };
  for (const tab of DASHBOARD_TABS) counts[tab.id] = hires.filter((h) => matchesTab(h, tab.id)).length;
  return counts;
}

/** Escrow is locked and the hire has not settled yet (active | escrowed | sla-check). */
export function isInFlight(hire: Hire): boolean {
  return IN_FLIGHT_STATUSES.has(hire.status);
}

/** Escrow has been released to the agent or refunded to the hirer. */
export function isSettled(hire: Hire): boolean {
  return SETTLED_STATUSES.has(hire.status);
}

/* ------------------------------- accents ------------------------------- */

export const STATUS_ACCENT: Record<HireStatus, { bar: string; text: string; hex: string }> = {
  pending: { bar: 'bg-slate-400', text: 'text-slate-300', hex: '#94A3B8' },
  escrowed: { bar: 'bg-bnb', text: 'text-bnb', hex: '#F0B90B' },
  active: { bar: 'bg-cyan-400', text: 'text-cyan-300', hex: '#22D3EE' },
  'sla-check': { bar: 'bg-violet-400', text: 'text-violet-300', hex: '#A78BFA' },
  released: { bar: 'bg-emerald-400', text: 'text-emerald-300', hex: '#34D399' },
  refunded: { bar: 'bg-rose-400', text: 'text-rose-300', hex: '#FB7185' },
  disputed: { bar: 'bg-rose-400', text: 'text-rose-300', hex: '#FB7185' },
};

/* ------------------------------- resolve ------------------------------- */

export interface ResolvedHire {
  hire: Hire;
  agent?: Agent;
  tier?: PricingTier;
  category?: Category;
  /** For A2A hires: the calling agent, when Bazar indexes it */
  caller?: Agent;
}

export function resolveHire(hire: Hire): ResolvedHire {
  const agent = getAgent(hire.agentId);
  const tier = agent?.pricing.find((t) => t.id === hire.tierId);
  const category = agent ? CATEGORY_MAP[agent.category] : undefined;
  const caller = hire.callerAgent ? getAgent(hire.callerAgent) : undefined;
  return { hire, agent, tier, category, caller };
}

/** Human-readable label for the agent that placed an A2A hire. */
export function callerLabel(resolved: ResolvedHire): string | undefined {
  const { hire, caller } = resolved;
  if (caller) return caller.name;
  if (!hire.callerAgent) return undefined;
  return isAddress(hire.callerAgent) ? shortAddress(hire.callerAgent) : hire.callerAgent;
}

/** True when a formatRelative() string points into the past ("… ago"). */
export function hasEnded(relative: string): boolean {
  return relative.endsWith('ago');
}

/** Shift an ISO timestamp by N minutes. Pure arithmetic on a fixed input — SSR safe. */
export function shiftIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}
