/**
 * Maps a raw 8004scan record onto Bazar's IndexedAgent.
 *
 * The only invented values here are cosmetic: an avatar gradient and initials
 * for agents that registered without an image. Every number the UI renders as
 * a metric comes straight off the index, through the single canonical reader
 * in lib/indexer/reputation.ts.
 *
 * This maps BOTH shapes the index returns - a listing row and the richer
 * per-agent record - so whichever route an agent was fetched from, the object
 * the UI sees is identical. That is what keeps the human page and the machine
 * endpoint from disagreeing.
 */

import type { Address, IndexedAgent } from '@/lib/types';
import { classify, explain } from '@/lib/indexer/classify';
import { readReputation } from '@/lib/indexer/reputation';
import type { ScanAgent } from '@/lib/indexer/scan-client';

/** Stable gradient per agent so avatars do not reshuffle between renders. */
const GRADIENTS = [
  'from-cyan-400 to-blue-600',
  'from-amber-300 to-yellow-600',
  'from-emerald-400 to-teal-600',
  'from-violet-400 to-fuchsia-600',
  'from-sky-400 to-indigo-600',
  'from-rose-400 to-orange-500',
  'from-lime-300 to-emerald-500',
  'from-purple-400 to-pink-600',
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Up to two initials from the agent's name, ignoring emoji and punctuation. */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'AI';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** "56:0x8004…:310926" -> "56-310926", safe in a URL and stable over time. */
export function slugOf(agent: Pick<ScanAgent, 'chain_id' | 'token_id'>): string {
  return `${agent.chain_id}-${agent.token_id}`;
}

export function mapAgent(raw: ScanAgent): IndexedAgent {
  const name = raw.name?.trim() || `Agent #${raw.token_id}`;
  const description = raw.description?.trim() || '';
  const classification = classify({ name, description, seed: raw.agent_id });

  return {
    slug: slugOf(raw),
    agentId: raw.agent_id,
    tokenId: raw.token_id,
    chainId: raw.chain_id,
    registry: raw.contract_address as Address,
    owner: raw.owner_address as Address,
    ownerLabel: raw.owner_ens || raw.owner_certified_name || raw.owner_username || null,
    name,
    description,
    imageUrl: raw.image_url || null,
    verified: Boolean(raw.is_verified),
    // One reader, always. The index publishes two conflicting `total_score`
    // values and `readReputation` is the only thing allowed to choose between
    // them, so a card, a sort key, a detail page and the A2A API cannot drift.
    reputation: readReputation(raw),
    protocols: Array.isArray(raw.supported_protocols) ? raw.supported_protocols : [],
    x402: Boolean(raw.x402_supported),
    category: classification.category,
    categoryConfidence: classification.confidence,
    categoryReason: explain(classification),
    registeredAt: raw.created_at,
    updatedAt: raw.updated_at,
    avatar: {
      gradient: GRADIENTS[hash(raw.agent_id) % GRADIENTS.length],
      initials: initialsOf(name),
    },
  };
}

export function mapAgents(raw: ScanAgent[]): IndexedAgent[] {
  return raw.map(mapAgent);
}

/**
 * Everything `mapAgent` reads, checked before an unshaped record is trusted.
 *
 * The per-agent route returns an open record, so this is the gate between
 * "the index answered" and "the index answered with an agent". A record that
 * fails it is treated as no answer rather than mapped into a half-empty page.
 */
export function isMappableRecord(raw: Record<string, unknown>): boolean {
  return (
    typeof raw.agent_id === 'string' &&
    typeof raw.token_id === 'string' &&
    typeof raw.chain_id === 'number' &&
    typeof raw.contract_address === 'string' &&
    typeof raw.owner_address === 'string' &&
    typeof raw.created_at === 'string' &&
    typeof raw.updated_at === 'string'
  );
}
