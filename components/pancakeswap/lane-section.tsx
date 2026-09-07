import { Radar, Scale, ShieldCheck, TrendingUp, type AppIcon } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/utils';
import type { LaneGroup } from '@/lib/pancakeswap/lane';
import { LANE_INTENT_MAP, type LaneIntent } from '@/lib/pancakeswap/intents';
import { INTENT_TONE, LaneAgentEntry } from './lane-evidence';

const INTENT_ICONS: Record<LaneIntent['icon'], AppIcon> = {
  Scale,
  TrendingUp,
  Radar,
  ShieldCheck,
};

/**
 * How many cards a group shows before the rest go behind a disclosure.
 *
 * Position management is the busiest shelf by a distance, and a page that
 * opens with twenty-one cards before the reader reaches the second job is a
 * list, not a lane. The remainder is one click away in a native `<details>`,
 * so nothing is hidden from a reader without JavaScript, from search, or from
 * find-in-page in browsers that expand on match.
 */
const VISIBLE_PER_GROUP = 6;

function GroupGrid({
  agents,
  offset = 0,
}: {
  agents: LaneGroup['agents'];
  offset?: number;
}) {
  return (
    <ul role="list" className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((entry, i) => (
        <LaneAgentEntry key={entry.agent.slug} entry={entry} index={offset + i} />
      ))}
    </ul>
  );
}

/**
 * One trader-or-LP job, with the agents whose own registration text claims it.
 *
 * A group only ever renders when it has agents in it - `buildLane` drops the
 * empty ones rather than printing a heading over nothing. An empty shelf under
 * a confident title is a claim that the shelf could have been filled, and on
 * this index some of them cannot be.
 */
export function LaneSection({ group }: { group: LaneGroup }) {
  const intent = LANE_INTENT_MAP[group.intent];
  const Icon = INTENT_ICONS[intent.icon];
  const visible = group.agents.slice(0, VISIBLE_PER_GROUP);
  const rest = group.agents.slice(VISIBLE_PER_GROUP);
  const duplicates = group.identityCount - group.agents.length;

  return (
    <section aria-labelledby={`lane-${intent.id}`} className="scroll-mt-24" id={intent.id}>
      <header className="border-t border-white/[0.08] pt-8">
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]"
            style={{ color: intent.accentHex }}
          >
            <Icon className="h-4.5 w-4.5" />
          </span>
          <h2 id={`lane-${intent.id}`} className="text-xl font-semibold tracking-tight text-white">
            {intent.name}
          </h2>
          <Badge tone={INTENT_TONE[intent.id]} size="md">
            <span className="tabular">{formatNumber(group.agents.length, { compact: false })}</span>
            <span className="ml-1 font-normal">
              {group.agents.length === 1 ? 'agent' : 'agents'}
            </span>
          </Badge>
        </div>

        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300">
          &ldquo;{intent.question}&rdquo;
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{intent.summary}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
          Every agent below names PancakeSwap and this job in the text its own registrant published
          onchain. The quote under each card is that text.
          {duplicates > 0 && (
            <>
              {' '}
              <span className="tabular">{formatNumber(duplicates, { compact: false })}</span> further{' '}
              {duplicates === 1 ? 'identity registers' : 'identities register'} text identical to a
              card here and {duplicates === 1 ? 'is' : 'are'} named on it rather than shown twice.
            </>
          )}
        </p>
      </header>

      <div className="mt-6">
        <GroupGrid agents={visible} />
      </div>

      {rest.length > 0 && (
        <details className="group mt-4">
          <summary className="ring-focus inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white">
            <span className="group-open:hidden">
              Show {formatNumber(rest.length, { compact: false })} more in {intent.name.toLowerCase()}
            </span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <div className="mt-4">
            <GroupGrid agents={rest} offset={VISIBLE_PER_GROUP} />
          </div>
        </details>
      )}
    </section>
  );
}
