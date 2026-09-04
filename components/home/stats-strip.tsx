'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { CATEGORIES } from '@/lib/data/categories';
import { formatNumber } from '@/lib/utils';

export interface StatsStripProps {
  /** Agents indexed on this chain - ERC-8004 Identity Registry. */
  indexedAgents: number;
  /** Indexed agents advertising x402 machine payments. */
  x402Agents: number;
  chainId: number;
  /**
   * ERC-8183 jobs created on the AgenticCommerce kernel Bazar settles against,
   * or null when the kernel could not be read. This replaced a "Chain ID: 56"
   * cell: a constant is not a statistic, and this number is both live and the
   * strongest thing the strip can say - the settlement layer Bazar uses is in
   * production, with tens of thousands of real jobs on it.
   */
  kernelJobs: number | null;
  /** True when the indexer was unreachable; index-derived cells show no number. */
  degraded: boolean;
}

interface Cell {
  label: string;
  hint: string;
  value: number;
  /** Count-up looks right on a large tally, silly on "4" or "56". */
  animate: boolean;
  /** Index-derived, so it has nothing honest to show when the indexer is down. */
  fromIndex: boolean;
}

/**
 * Counts from 0 to `target` once `active` flips true. The initial state is the
 * final value so SSR (and hydration) always render the real number.
 */
function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);

  return value;
}

function StatCell({ cell, active, degraded }: { cell: Cell; active: boolean; degraded: boolean }) {
  const unavailable = degraded && cell.fromIndex;
  const counted = useCountUp(cell.value, active && cell.animate && !unavailable);
  const shown = cell.animate ? counted : cell.value;

  return (
    <div className="bg-surface px-5 py-5 sm:py-6">
      <p className="tabular text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {unavailable ? <span className="text-slate-500">Unavailable</span> : formatNumber(Math.round(shown), { compact: false })}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">{cell.label}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{unavailable ? 'Indexer unreachable' : cell.hint}</p>
    </div>
  );
}

/**
 * Four numbers, all of which have a source you can check.
 *
 * The registries publish identity and reputation only, so there is no escrow
 * total, no hire count, no A2A call volume and no SLA average to show here -
 * those were removed rather than re-sourced.
 */
export function StatsStrip({ indexedAgents, x402Agents, chainId,
  kernelJobs, degraded }: StatsStripProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });

  const cells: Cell[] = [
    {
      label: 'Agents indexed',
      hint: 'ERC-8004 Identity Registry',
      value: indexedAgents,
      animate: true,
      fromIndex: true,
    },
    {
      label: 'x402-capable',
      hint: 'Advertise machine payments',
      value: x402Agents,
      animate: true,
      fromIndex: true,
    },
    {
      label: 'Categories',
      hint: 'BNB Agent Studio taxonomy',
      value: CATEGORIES.length,
      animate: false,
      fromIndex: false,
    },
    {
      label: 'ERC-8183 jobs',
      hint: kernelJobs === null ? 'Kernel unreachable' : 'Created on the settlement kernel',
      value: kernelJobs ?? 0,
      animate: kernelJobs !== null,
      fromIndex: false,
    },
  ];

  return (
    <section aria-label="Marketplace statistics" className="container-x relative z-10 pb-6 sm:pb-10">
      <div
        ref={ref}
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] shadow-card lg:grid-cols-4"
      >
        {cells.map((cell) => (
          <StatCell key={cell.label} cell={cell} active={inView} degraded={degraded} />
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">
        {degraded
          ? 'Live counts are unavailable - the ERC-8004 index is not answering. Nothing here is filled in from cache.'
          : 'Read live from the ERC-8004 Identity Registry index. Bazar shows no escrow, hire or SLA totals because the registries publish none.'}
      </p>
    </section>
  );
}
