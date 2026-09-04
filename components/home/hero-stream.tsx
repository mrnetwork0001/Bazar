import Link from 'next/link';
import type { IndexedAgent } from '@/lib/types';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { UNCLASSIFIED_HEX, isUnclassified } from '@/components/marketplace/marketplace-config';
import { cn } from '@/lib/utils';

/**
 * The marketplace, moving.
 *
 * This replaced a tall static composition of a request/response terminal and a
 * single agent card. That explained the product but showed nothing of it, and
 * it forced the hero to be far taller than it needed to be.
 *
 * Every card here is a real indexed agent - name, ERC-8004 token id, category
 * and reputation straight off the registry, from the same ranked page the rest
 * of the landing page already fetched, so the motion costs no extra request.
 * A bazaar is a place where things move past you, and the strongest claim this
 * project has is that the inventory is real, so the hero shows the inventory
 * rather than describing it.
 *
 * The columns are pure CSS: each list is rendered twice and translated by half
 * its height, so the loop is seamless with no JS and no timers. Under
 * prefers-reduced-motion the animation stops and the columns simply sit still,
 * which globals.css enforces globally.
 */

export interface HeroStreamProps {
  agents: IndexedAgent[];
  degraded: boolean;
}

function AgentChip({ agent }: { agent: IndexedAgent }) {
  const score = agent.reputation.totalScore;
  // The classifier assigns a category by hash when an agent's registration text
  // carries no signal, and most top-ranked agents are in that bucket. Every
  // other surface says "Unclassified" for those; the hero must not be the one
  // place that states a hash placement as fact.
  const unclassified = isUnclassified(agent);
  const category = unclassified ? null : CATEGORY_MAP[agent.category];
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="glass glass-hover block rounded-xl p-3"
      // The stream is decorative motion around real links; each card is still a
      // real destination, so it stays keyboard reachable and not aria-hidden.
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[11px] font-semibold text-ink',
            agent.avatar.gradient,
          )}
          aria-hidden
        >
          {agent.avatar.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white">{agent.name}</span>
          <span className="block truncate text-[11px] text-slate-500">
            <span style={{ color: unclassified ? UNCLASSIFIED_HEX : category?.accentHex }}>
              {unclassified ? 'Unclassified' : (category?.name ?? 'Unclassified')}
            </span>
            <span className="text-slate-600"> · #{agent.tokenId}</span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="tabular block text-[13px] font-medium text-white">{score.toFixed(1)}</span>
          <span className="block text-[10px] text-slate-600">rep</span>
        </span>
      </div>
    </Link>
  );
}

function Column({ agents, direction }: { agents: IndexedAgent[]; direction: 'up' | 'down' }) {
  if (agents.length === 0) return null;
  // Rendered twice so the translate wraps seamlessly.
  const doubled = [...agents, ...agents];
  return (
    <div className="group relative h-full overflow-hidden">
      <div
        className={cn(
          // Pauses on hover: these cards are real destinations, and motion that
          // slides out from under a pointer is motion that cannot be clicked.
          'flex flex-col gap-2.5 group-hover:[animation-play-state:paused]',
          direction === 'up' ? 'animate-marquee-up' : 'animate-marquee-down',
        )}
      >
        {doubled.map((agent, i) => (
          <AgentChip key={`${agent.slug}-${i}`} agent={agent} />
        ))}
      </div>
    </div>
  );
}

export function HeroStream({ agents, degraded }: HeroStreamProps) {
  if (degraded || agents.length === 0) {
    return (
      <div className="glass flex h-[360px] items-center justify-center rounded-2xl p-6 text-center">
        <p className="max-w-xs text-sm leading-relaxed text-slate-400">
          The ERC-8004 index is unreachable right now, so there is nothing real to show here. Bazar renders no
          placeholder listings.
        </p>
      </div>
    );
  }

  const half = Math.ceil(agents.length / 2);
  const left = agents.slice(0, half);
  const right = agents.slice(half);

  return (
    <div className="relative">
      <div
        className="grid h-[360px] grid-cols-2 gap-2.5 sm:h-[400px]"
        // Fades the columns out at both ends so cards enter and leave rather
        // than being clipped by a hard edge.
        style={{
          maskImage: 'linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)',
        }}
      >
        <Column agents={left} direction="up" />
        <Column agents={right} direction="down" />
      </div>
      <p className="mt-3 text-center text-[11px] text-slate-600">
        Live from the ERC-8004 Identity Registry on BNB Smart Chain
      </p>
    </div>
  );
}
