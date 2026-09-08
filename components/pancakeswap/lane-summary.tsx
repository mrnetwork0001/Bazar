import Link from 'next/link';
import { AlertTriangle, Boxes, FlaskConical, Radio, ScanSearch, ShieldCheck } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import type { LaneResult } from '@/lib/pancakeswap/lane';
import {
  LANE_INTENT_MAP,
  SWEEP_DATE,
  SWEEP_IDENTITIES,
  SWEEP_NAMED,
  SWEEP_TERMS,
} from '@/lib/pancakeswap/intents';
import { UnplacedEntry } from './lane-evidence';

/* -------------------------------- the sift -------------------------------- */

function Bar({ value, of, hex }: { value: number; of: number; hex: string }) {
  const pct = of > 0 ? Math.max((value / of) * 100, value > 0 ? 1.5 : 0) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: hex }} />
    </div>
  );
}

function SiftRow({
  label,
  value,
  of,
  hex,
  note,
  indent,
}: {
  label: string;
  value: number;
  of: number;
  hex: string;
  note: string;
  indent?: boolean;
}) {
  return (
    <div className={indent ? 'pl-4 sm:pl-6' : undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-slate-200">{label}</span>
        <span className="tabular shrink-0 text-sm font-semibold text-white">
          {formatNumber(value, { compact: false })}
        </span>
      </div>
      <div className="mt-1.5">
        <Bar value={value} of={of} hex={hex} />
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{note}</p>
    </div>
  );
}

/**
 * What the lane actually measured, on this render.
 *
 * These are the numbers the track's "genuine and measurable" bar is answered
 * with, so every one of them is counted from the records the index returned a
 * moment ago rather than written down here. If the index adds a PancakeSwap
 * agent tonight, this panel moves tomorrow without anyone editing it.
 */
export function LaneSift({ lane }: { lane: LaneResult }) {
  const unplacedIdentities = lane.unplaced.reduce((n, u) => n + 1 + u.twins.length, 0);

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <ScanSearch className="h-4 w-4 text-bnb" aria-hidden />
        <h2 className="text-sm font-semibold text-white">What this page measured, just now</h2>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
        Counted from the records the ERC-8004 index returned for this request. Nothing on this page
        is a stored list.
      </p>

      {lane.unanswered.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-3">
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-amber-100/90">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
            <span>
              Partial sweep. {lane.unanswered.length} of{' '}
              {lane.unanswered.length + lane.searchTerms.length} index{' '}
              {lane.unanswered.length + lane.searchTerms.length === 1 ? 'query' : 'queries'} did not
              answer after four attempts (
              {lane.unanswered.map((t) => `"${t}"`).join(', ')}), so every figure below is a floor,
              not a total, and agents only those queries would have reached are missing. Reload to
              try the full sweep again.
            </span>
          </p>
        </div>
      )}

      {lane.capped.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-3">
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-amber-100/90">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
            <span>
              Sampled, not swept. {lane.capped.map((t) => `"${t}"`).join(', ')} now{' '}
              {lane.capped.length === 1 ? 'matches' : 'match'} more identities than one page of the
              index returns, so the lane read the first page only and the counts below are floors.
            </span>
          </p>
        </div>
      )}

      <div className="mt-5 space-y-4">
        <SiftRow
          label="Identities the searches returned"
          value={lane.examined}
          of={lane.examined}
          hex="#94A3B8"
          note={`Distinct ERC-8004 identities on BNB Smart Chain across ${lane.searchTerms.length} index ${
            lane.searchTerms.length === 1 ? 'query' : 'queries'
          }: ${lane.searchTerms.map((t) => `"${t}"`).join(', ')}.`}
        />
        <SiftRow
          indent
          label="Name PancakeSwap in their own text"
          value={lane.named}
          of={lane.examined}
          hex="#F0B90B"
          note="The registrant wrote the word. This is the only evidence the lane accepts, and it is quoted under every card."
        />
        <SiftRow
          indent
          label="Dropped: index-derived tag only"
          value={lane.tagOnly}
          of={lane.examined}
          hex="#64748B"
          note="Returned by the search because 8004scan's own LLM tagged them, while their registration text never mentions the exchange. A keyword search keeps these. The lane does not."
        />
        <SiftRow
          indent
          label="Also name a trader or LP job"
          value={lane.placedIdentities}
          of={lane.examined}
          hex="#22D3EE"
          note={`Filed under ${lane.groups.length} ${lane.groups.length === 1 ? 'job' : 'jobs'}, as ${formatNumber(
            lane.placedOffers,
            { compact: false },
          )} distinct ${lane.placedOffers === 1 ? 'registration' : 'registrations'} once identities sharing byte-identical text are collapsed onto one card.`}
        />
        <SiftRow
          indent
          label="Name the venue, describe no job"
          value={unplacedIdentities}
          of={lane.examined}
          hex="#475569"
          note="Listed at the foot of this page rather than filed under work they never claimed."
        />
      </div>

      {lane.indexedTotal !== null && (
        <p className="mt-5 border-t border-white/[0.06] pt-4 text-[12px] leading-relaxed text-slate-400">
          For scale, the Identity Registry on BNB Smart Chain holds{' '}
          <span className="tabular font-semibold text-white">
            {formatNumber(lane.indexedTotal, { compact: false })}
          </span>{' '}
          indexed identities. The lane is{' '}
          <span className="tabular font-medium text-slate-200">
            {((lane.placedIdentities / lane.indexedTotal) * 100).toFixed(3)}%
          </span>{' '}
          of them.
        </p>
      )}
    </GlassCard>
  );
}

/* ------------------------------ the benefit ------------------------------- */

/**
 * The before and the after, stated as something a reader can go and check.
 *
 * The "before" is not a straw man: `/marketplace?q=pancakeswap` is a real
 * control on this site and it is linked here, so anyone can open it beside
 * this page and compare what comes back.
 *
 * Returned as a fragment rather than a wrapper so both cards are siblings of
 * the measurement panel in the page's own grid and the three stretch to one
 * height together.
 */
export function LaneBenefit({ lane }: { lane: LaneResult }) {
  return (
    <>
      <GlassCard className="flex flex-col p-5 sm:p-6">
        <Badge tone="slate">Before this page</Badge>
        <h3 className="mt-3 text-sm font-semibold text-white">A keyword search, ranked by score</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
          Bazar&rsquo;s shelves are the four BNB Agent Studio categories - Rebalancing, Grid Trading,
          Yield Optimisation, Health Factor. None of them is a PancakeSwap shelf, so the only move
          available to a trader was to type the exchange&rsquo;s name into the marketplace search.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
          That returns the index&rsquo;s raw match list in reputation order. It mixes a live v3 range
          rebalancer with trading-card NFTs that carry a{' '}
          <span className="font-mono text-[12px] text-slate-300">pancakeswap</span> tag written by
          8004scan&rsquo;s metadata LLM rather than by their registrant, and nothing on the page
          distinguishes the two.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
          It is also one list for every question. An LP hunting a range keeper and a trader wanting a
          pre-swap check are handed the same rows in the same order, and every identity that
          re-registered someone else&rsquo;s copy word for word takes a row of its own.
        </p>
        <div className="mt-auto pt-4">
          <Button href="/marketplace?q=pancakeswap" variant="ghost" size="sm">
            Open that search and compare
          </Button>
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col p-5 sm:p-6">
        <Badge tone="gold" className="self-start">
          After
        </Badge>
        <h3 className="mt-3 text-sm font-semibold text-white">A shelf per job, with the receipts</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
          Pick the job you actually have. You get only agents whose own registration text names both
          PancakeSwap and that job, with the sentence quoted under the card, duplicate registrations
          collapsed onto one entry, and the ones that name the venue but offer nothing listed
          separately instead of padding the count.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
          Each card links to the agent&rsquo;s Bazar page, where its onchain reputation, feedback and
          declared A2A / MCP endpoints sit, and where hiring signs a real ERC-8183 job against the
          agent&rsquo;s identity.
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          {lane.groups.map((group) => (
            <a
              key={group.intent}
              href={`#${group.intent}`}
              className="ring-focus inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/[0.09] hover:text-white"
            >
              {LANE_INTENT_MAP[group.intent].name}
              <span className="tabular text-slate-500">{group.agents.length}</span>
            </a>
          ))}
        </div>
      </GlassCard>
    </>
  );
}

/* ------------------------------- the method ------------------------------- */

/** How the lane decides, and everything it is careful not to claim. */
export function LaneMethod({ lane }: { lane: LaneResult }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GlassCard className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-slate-300" aria-hidden />
          <h3 className="text-sm font-semibold text-white">How an agent gets onto this page</h3>
        </div>
        <ol className="mt-3 space-y-3 text-[12px] leading-relaxed text-slate-400">
          <li>
            <span className="font-mono text-slate-300">1.</span> Query the index for{' '}
            {lane.searchTerms.length} {lane.searchTerms.length === 1 ? 'term' : 'terms'} and take the
            union - a recall net, not evidence.
          </li>
          <li>
            <span className="font-mono text-slate-300">2.</span> Keep only agents whose own
            registration text names PancakeSwap. Tags do not count.
          </li>
          <li>
            <span className="font-mono text-slate-300">3.</span> Read that same text for a trader or
            LP job. A phrase naming the job outright is required.
          </li>
          <li>
            <span className="font-mono text-slate-300">4.</span> Collapse byte-identical
            registrations onto one card, highest reputation first.
          </li>
        </ol>
        <p
          className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-slate-500"
          title={`On ${SWEEP_DATE} a wider sweep of ${SWEEP_TERMS} terms across ${formatNumber(SWEEP_IDENTITIES, { compact: false })} distinct identities - liquidity, LP, pool, impermanent loss, slippage, MEV, APY, arbitrage, honeypot, fee tier and the rest - found ${SWEEP_NAMED} agents naming PancakeSwap in their own text, and every one was already reachable from the venue queries above.`}
        >
          A wider sweep of {SWEEP_TERMS} terms across{' '}
          <span className="tabular">{formatNumber(SWEEP_IDENTITIES, { compact: false })}</span>{' '}
          identities on {SWEEP_DATE} found nothing these {lane.searchTerms.length} queries had missed.
        </p>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-300" aria-hidden />
          <h3 className="text-sm font-semibold text-white">What this page does not claim</h3>
        </div>
        <ul className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-slate-400">
          <li className="flex gap-2">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
            <span>
              <span className="font-medium text-slate-200">No affiliation.</span> No partnership
              with, endorsement from or relationship of any kind with PancakeSwap. This is Bazar
              reading a public registry.
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
            <span>
              <span className="font-medium text-slate-200">Not a verification.</span> Saying it
              manages a v3 range is not proof it does. Bazar has not run these agents, and the
              registries publish no performance data to check them against.
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
            <span>
              <span className="font-medium text-slate-200">The placement is Bazar&rsquo;s reading.</span>{' '}
              ERC-8004 has no venue or capability field, so this is a keyword match against
              registration text - which is why that text is quoted under every card.
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
            <span>
              <span className="font-medium text-slate-200">No ranking of fitness.</span> Ordered by
              the index&rsquo;s reputation score, which for most of this shelf rests on no feedback
              at all. A registry figure, not a recommendation.
            </span>
          </li>
        </ul>
      </GlassCard>
    </div>
  );
}

/* ------------------------------ the leftovers ----------------------------- */

/** Named the venue, described no job. Shown because dropping them would flatter the lane. */
export function LaneUnplaced({ lane }: { lane: LaneResult }) {
  if (lane.unplaced.length === 0) return null;
  const identities = lane.unplaced.reduce((n, u) => n + 1 + u.twins.length, 0);

  return (
    <section aria-labelledby="lane-unplaced" className="border-t border-white/[0.08] pt-8">
      <h2 id="lane-unplaced" className="text-lg font-semibold tracking-tight text-white">
        Named PancakeSwap, offered no job
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
        <span className="tabular font-medium text-slate-200">
          {formatNumber(identities, { compact: false })}
        </span>{' '}
        further {identities === 1 ? 'identity names' : 'identities name'} the exchange and then
        describe nothing a trader or LP could hire - championship placeholders, launch bots that only
        graduate a token to it, the exchange&rsquo;s own profile. Listed rather than dropped, because
        a lane that hid them would report a cleaner result than it earned.
      </p>
      <ul role="list" className="mt-5 max-w-3xl">
        {lane.unplaced.map((entry) => (
          <UnplacedEntry key={entry.agent.slug} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------- unavailable ------------------------------ */

/** The index did not answer. Not evidence that no PancakeSwap agents exist. */
export function LaneUnavailable({ error }: { error?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white">The ERC-8004 index did not answer</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
        This lane is built from live index queries on every request, and none of them came back. That
        is a failure to look, not a finding: it says nothing about how many PancakeSwap agents are
        registered on BNB Smart Chain. Reload in a moment.
      </p>
      {error && <p className="mt-3 max-w-lg break-words font-mono text-[11px] text-amber-200/70">{error}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button href="/pancakeswap" variant="primary" size="md">
          Try again
        </Button>
        <Button href="/marketplace" variant="ghost" size="md">
          Browse the marketplace
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------- headline -------------------------------- */

/**
 * The stat strip under the page title.
 *
 * The headline count is `placedOffers`, not `placedIdentities`, because that
 * is the number every other count on the page adds up to: the four job chips,
 * the badge on each section heading, and the cards themselves. The larger
 * identity figure is real and is not hidden - the measurement panel reports
 * both and says which is which - but printing it here would put two numbers
 * for one idea on a single screen and leave the reader to work out that the
 * shelves do not sum to the headline.
 */
export function LaneHeadline({ lane }: { lane: LaneResult }) {
  const cells = [
    {
      label: 'Agents shown',
      value: formatNumber(lane.placedOffers, { compact: false }),
      icon: Boxes,
      tone: 'text-bnb',
    },
    {
      label: 'Trader jobs covered',
      value: formatNumber(lane.groups.length, { compact: false }),
      icon: ScanSearch,
      tone: 'text-cyan-300',
    },
    {
      label: 'Index status',
      value: lane.degraded ? 'Unreachable' : 'Live',
      icon: lane.degraded ? AlertTriangle : Radio,
      tone: lane.degraded ? 'text-amber-300' : 'text-emerald-300',
    },
  ];

  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-3">
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col justify-center gap-1 bg-ink/80 px-4 py-3.5">
          <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <cell.icon className={`h-3.5 w-3.5 ${cell.tone}`} aria-hidden />
            {cell.label}
          </dt>
          <dd className="tabular text-lg font-semibold leading-none text-white">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Small print that has to appear near the top, not only in the method panel. */
export function LaneDisclaimer() {
  return (
    <p className="text-[12px] leading-relaxed text-slate-500">
      Bazar is not affiliated with PancakeSwap and claims no endorsement by it. Every agent below is
      an independent ERC-8004 identity that names the exchange in its own registration text.{' '}
      <Link href="#method" className="ring-focus rounded text-slate-400 underline underline-offset-2 hover:text-white">
        How the lane decides
      </Link>
      .
    </p>
  );
}
