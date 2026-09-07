import type { Metadata } from 'next';
import { Boxes, Radio } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { buildLane } from '@/lib/pancakeswap/lane';
import { LaneSection } from '@/components/pancakeswap/lane-section';
import {
  LaneBenefit,
  LaneDisclaimer,
  LaneHeadline,
  LaneMethod,
  LaneSift,
  LaneUnavailable,
  LaneUnplaced,
} from '@/components/pancakeswap/lane-summary';

export const metadata: Metadata = {
  title: 'Agents for PancakeSwap traders and LPs',
  description:
    'ERC-8004 agents on BNB Smart Chain that name PancakeSwap in their own registration text, grouped by the job a trader or liquidity provider actually has: position management, yield discovery, swap safety, pool research. Bazar is not affiliated with PancakeSwap.',
};

/**
 * The PancakeSwap lane.
 *
 * Bazar's asset is discovery across every ERC-8004 identity on BNB Smart
 * Chain. Its shelves, though, are the four BNB Agent Studio categories, and
 * none of them is a shelf a PancakeSwap trader would recognise. A liquidity
 * provider whose v3 range has drifted out has a specific question and no way
 * to ask it: the nearest thing the site offered was typing "pancakeswap" into
 * the marketplace search, which returns whatever the index's own full-text
 * matcher touched, LLM-written tags included, in reputation order.
 *
 * This page is the shelf that was missing. It is built entirely from live
 * index queries on every render - there is no curated list here, and there is
 * nothing to keep up to date - and its whole method is one rule applied twice:
 * an agent is only on this page because of words its own registrant published
 * onchain, and those words are printed under its card.
 */
export default async function PancakeSwapLanePage() {
  const lane = await buildLane();

  if (lane.degraded) {
    return (
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-hero-glow opacity-70" aria-hidden />
        <main className="container-x pb-24 pt-10 sm:pt-14">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-gradient-white sm:text-5xl">
            Agents for PancakeSwap traders and LPs
          </h1>
          <div className="mt-8">
            <LaneUnavailable error={lane.error} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-hero-glow opacity-80" aria-hidden />
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] opacity-60" aria-hidden />

      <main className="container-x pb-24 pt-10 sm:pt-14">
        {/* Header */}
        <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="gold" size="md" icon={<Boxes className="h-3.5 w-3.5" aria-hidden />}>
                ERC-8004 on BNB Smart Chain
              </Badge>
              <Badge
                tone="emerald"
                size="md"
                icon={
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                }
              >
                Read live from the index
              </Badge>
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-gradient-white sm:text-5xl">
              Agents for PancakeSwap traders and LPs
            </h1>

            <p className="mt-4 text-base leading-relaxed text-slate-400">
              The Identity Registry on BNB Smart Chain is a flat list of a few hundred thousand
              agents with no venue field and no capability field. Somewhere in it are the agents that
              watch a v3 range, price a fee tier, check a pool before you swap into it - and until
              this page there was no way to ask for them by the job you have.
            </p>
            <p className="mt-3 text-base leading-relaxed text-slate-400">
              This lane asks the index on every request, then keeps only the identities whose own
              registration text names both PancakeSwap and the job. The sentence that qualified each
              one is printed under its card.
            </p>

            <div className="mt-5">
              <LaneDisclaimer />
            </div>
          </div>

          <div className="lg:pb-1">
            <LaneHeadline lane={lane} />
          </div>
        </header>

        {/* The measurable claim: what was sifted, and what the sift buys you */}
        <div className="mt-10 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LaneSift lane={lane} />
          <LaneBenefit lane={lane} />
        </div>

        {/* The shelves */}
        <div className="mt-14 space-y-14">
          {lane.groups.map((group) => (
            <LaneSection key={group.intent} group={group} />
          ))}
        </div>

        {/* Everything the shelves would not honestly hold */}
        <div className="mt-16">
          <LaneUnplaced lane={lane} />
        </div>

        {/* Method */}
        <section id="method" aria-labelledby="method-heading" className="mt-16 scroll-mt-24 border-t border-white/[0.08] pt-8">
          <h2 id="method-heading" className="text-lg font-semibold tracking-tight text-white">
            Method, and its limits
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
            <Radio className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
            Built from {lane.searchTerms.length} live{' '}
            {lane.searchTerms.length === 1 ? 'query' : 'queries'} against the public ERC-8004 index
            on chain 56, cached for thirty minutes.
          </p>
          <div className="mt-5">
            <LaneMethod lane={lane} />
          </div>
        </section>
      </main>
    </div>
  );
}
