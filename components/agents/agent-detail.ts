/**
 * Facts the ERC-8004 index publishes on its per-agent record that the listing
 * endpoint omits. Kept beside the components that render them (and out of the
 * `[id]` route folder, whose bracketed path webpack will not resolve as an
 * import specifier) so both the resolver and the panels share one shape.
 *
 * `IndexedAgent` in lib/types.ts is a frozen contract and carries none of
 * these, so they travel alongside it rather than being folded into it.
 */

import type { Address, IndexedAgent } from '@/lib/types';

/* ------------------------------ extra facts ----------------------------- */

export interface AgentEndpoint {
  /** Protocol key as the index publishes it, e.g. "a2a", "mcp", "web". */
  protocol: string;
  /** The endpoint the agent's owner published. Not probed by Bazar. */
  url: string;
  version: string | null;
  /** MCP tool count, when the index resolved the server. */
  toolCount: number | null;
  /** A2A skill count, when the index parsed the agent card. */
  skillCount: number | null;
}

export interface ScoreDimension {
  key: string;
  label: string;
  value: number;
}

export interface AgentDetailExtras {
  /** Transaction that minted the identity NFT. */
  registrationTx: string | null;
  /** Address the agent operates from, distinct from the owner. */
  agentWallet: Address | null;
  endpoints: AgentEndpoint[];
  tags: string[];
  /** Trust models the agent declares, e.g. "reputation", "tee-attestation". */
  trustModels: string[];
  /** Component scores published alongside the aggregate. */
  scores: ScoreDimension[];
  scoredAt: string | null;
}

export interface AgentDetail {
  agent: IndexedAgent;
  extras: AgentDetailExtras;
}

export const EMPTY_EXTRAS: AgentDetailExtras = {
  registrationTx: null,
  agentWallet: null,
  endpoints: [],
  tags: [],
  trustModels: [],
  scores: [],
  scoredAt: null,
};
