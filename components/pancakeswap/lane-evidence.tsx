import Link from 'next/link';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { AgentCard } from '@/components/marketplace/agent-card';
import type { LaneAgent, UnplacedAgent, VenueEvidence } from '@/lib/pancakeswap/lane';
import { LANE_INTENT_MAP, type LaneIntentId } from '@/lib/pancakeswap/intents';

/**
 * The evidence a card is standing on, printed under the card.
 *
 * Bazar is asserting that a given ERC-8004 identity serves PancakeSwap traders
 * or LPs. It has no way to verify that the agent works, and no relationship
 * with the exchange, so the only defensible form of the claim is: here is the
 * sentence the registrant published, and here are the words in it that put the
 * agent on this shelf. A reader who disagrees with the placement can see
 * exactly what it was based on without leaving the page.
 */

export const INTENT_TONE: Record<LaneIntentId, BadgeTone> = {
  position: 'cyan',
  yield: 'violet',
  safety: 'emerald',
  research: 'gold',
};

/* -------------------------------- quoting -------------------------------- */

/**
 * The registrant's sentence with the venue phrase marked inside it.
 *
 * Split on the exact match rather than a case-insensitive re-scan, because
 * `VENUE_PATTERN` already captured the registrant's own capitalisation and
 * re-finding it would risk marking a different occurrence than the one the
 * lane actually admitted the agent on.
 */
function VenueQuote({ venue }: { venue: VenueEvidence }) {
  const at = venue.quote.indexOf(venue.match);
  const ellipsis = venue.truncated ? '…' : '';

  if (at < 0) {
    return (
      <span>
        {ellipsis}
        {venue.quote}
        {ellipsis}
      </span>
    );
  }

  return (
    <span>
      {ellipsis}
      {venue.quote.slice(0, at)}
      <mark className="rounded bg-bnb/20 px-1 py-0.5 font-medium text-bnb">{venue.match}</mark>
      {venue.quote.slice(at + venue.match.length)}
      {ellipsis}
    </span>
  );
}

/* ------------------------------ twin listing ------------------------------ */

/**
 * The other identities that registered this exact text.
 *
 * Bulk registration is real and visible on this index: nine ERC-8004
 * identities carry byte-identical high-frequency-trading copy, seven carry the
 * same oracle copy. Showing nine cards would tell a trader there are nine
 * options here when there is one offer registered nine times, and hiding the
 * duplicates would quietly delete real identities. So the lane shows one card
 * and names the rest.
 */
function TwinList({ twins }: { twins: LaneAgent['twins'] }) {
  if (twins.length === 0) return null;

  return (
    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
      <span className="tabular font-medium text-slate-400">{twins.length}</span> further{' '}
      {twins.length === 1 ? 'identity registers' : 'identities register'} this exact text:{' '}
      {twins.map((twin, i) => (
        <span key={twin.tokenId}>
          {i > 0 && <span aria-hidden>, </span>}
          <Link
            href={`/agents/${twin.slug}`}
            className="ring-focus rounded font-mono text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-white"
          >
            #{twin.tokenId}
          </Link>
        </span>
      ))}
      .
    </p>
  );
}

/* -------------------------------- entries -------------------------------- */

/**
 * One card in a lane group: the standard marketplace card, unmodified, with
 * the evidence for its placement beneath it.
 *
 * `AgentCard` is deliberately not forked. A PancakeSwap agent is the same
 * ERC-8004 identity it is everywhere else in Bazar, with the same reputation
 * and the same declared endpoints, and a lane-specific card would be a second
 * place for those to drift.
 */
export function LaneAgentEntry({ entry, index }: { entry: LaneAgent; index: number }) {
  const { agent, venue, job, alsoNames, twins } = entry;

  return (
    <li className="flex min-w-0 flex-col">
      <div className="flex-1">
        <AgentCard agent={agent} index={index} />
      </div>

      <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <blockquote className="text-[12px] leading-relaxed text-slate-400">
          <VenueQuote venue={venue} />
        </blockquote>
        <p className="sr-only">
          Quoted from the {venue.field === 'name' ? 'name' : 'description'} this agent registered
          onchain.
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Its words
          </span>
          {job.naming.map((word) => (
            <Badge key={word} tone={INTENT_TONE[job.intent]}>
              {word}
            </Badge>
          ))}
          {alsoNames.map((id) => (
            <Badge
              key={id}
              tone="slate"
              className="border-dashed"
              title={`The same text also names ${LANE_INTENT_MAP[id].name.toLowerCase()} work`}
            >
              also {LANE_INTENT_MAP[id].name.toLowerCase()}
            </Badge>
          ))}
        </div>

        <TwinList twins={twins} />
      </div>
    </li>
  );
}

/**
 * An identity that names PancakeSwap and then describes no trader or LP job.
 *
 * These are shown rather than dropped. Five of them are placeholder entries
 * for an agent championship, one is the exchange's own social-media profile,
 * several are memecoin launch bots that mention PancakeSwap only as the venue
 * a token graduates to. None of them is a service a trader can hire, and
 * saying so is more useful than silently shortening the count - it is also the
 * only way a reader can tell the lane apart from a keyword search that keeps
 * everything it touches.
 */
export function UnplacedEntry({ entry }: { entry: UnplacedAgent }) {
  const { agent, venue, twins } = entry;
  const identities = 1 + twins.length;

  return (
    <li className="min-w-0 border-t border-white/[0.06] py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Link
          href={`/agents/${agent.slug}`}
          className="ring-focus rounded text-sm font-medium text-slate-200 hover:text-white"
        >
          {agent.name}
        </Link>
        <span className="tabular font-mono text-[11px] text-slate-500">#{agent.tokenId}</span>
        {identities > 1 && (
          <span className="text-[11px] text-slate-500">
            and {identities - 1} identical {identities - 1 === 1 ? 'identity' : 'identities'}
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-slate-500">
        <VenueQuote venue={venue} />
      </p>
    </li>
  );
}
