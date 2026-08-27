'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { MARKET_STATS } from '@/lib/data/stats';
import { formatNumber, formatPct, formatUsd } from '@/lib/utils';

type Fmt = 'int' | 'usd' | 'pct';

interface StatDef {
  key: keyof typeof MARKET_STATS;
  label: string;
  hint: string;
  fmt: Fmt;
}

const STATS: StatDef[] = [
  { key: 'indexedAgents', label: 'Indexed agents', hint: 'ERC-8004 on BSC', fmt: 'int' },
  { key: 'verifiedAgents', label: 'Verified agents', hint: 'Identity + validation', fmt: 'int' },
  { key: 'totalEscrowedUsd', label: 'Total escrowed', hint: 'Locked on-chain', fmt: 'usd' },
  { key: 'a2aCalls24h', label: 'A2A calls / 24h', hint: 'Router requests', fmt: 'int' },
  { key: 'avgSla', label: 'Avg SLA', hint: 'Adherence score', fmt: 'pct' },
  { key: 'hiresCompleted', label: 'Hires completed', hint: 'Auto-released', fmt: 'int' },
];

function format(n: number, fmt: Fmt) {
  switch (fmt) {
    case 'usd':
      return formatUsd(n, { decimals: 2 });
    case 'pct':
      return formatPct(n, { sign: false, decimals: 1 });
    default:
      return formatNumber(Math.round(n), { compact: false });
  }
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

function StatCell({ stat, active }: { stat: StatDef; active: boolean }) {
  const target = MARKET_STATS[stat.key];
  const value = useCountUp(target, active);
  return (
    <div className="bg-surface px-5 py-5 sm:py-6">
      <p className="tabular text-2xl font-semibold tracking-tight text-white sm:text-3xl">{format(value, stat.fmt)}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">{stat.label}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{stat.hint}</p>
    </div>
  );
}

export function StatsStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });

  return (
    <section aria-label="Marketplace statistics" className="container-x relative z-10 pb-6 sm:pb-10">
      <div
        ref={ref}
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] shadow-card sm:grid-cols-3 lg:grid-cols-6"
      >
        {STATS.map((s) => (
          <StatCell key={s.key} stat={s} active={inView} />
        ))}
      </div>
    </section>
  );
}
