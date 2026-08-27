'use client';

import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { Agent } from '@/lib/types';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { clamp, cn, formatPct } from '@/lib/utils';

type RangeKey = '7D' | '30D';

const RANGES: ReadonlyArray<{ key: RangeKey; points: number; label: string }> = [
  { key: '7D', points: 7, label: 'Last 7 days' },
  { key: '30D', points: 30, label: 'Last 30 days' },
];

/** "D-12" for past days, "Today" for the final point. */
function dayLabel(index: number, length: number) {
  const back = length - 1 - index;
  return back === 0 ? 'Today' : `D-${back}`;
}

/** Evenly spaced tick indices across `length` points, first and last included. */
function tickIndices(length: number, count: number): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const i = Math.round((k * (length - 1)) / (count - 1));
    if (!out.includes(i)) out.push(i);
  }
  return out;
}

export interface PerformanceChartProps {
  agent: Agent;
  className?: string;
}

/**
 * Equity-curve area chart built straight from `agent.sparkline` (30 daily
 * points, base 100).
 *
 * The plot is a `preserveAspectRatio="none"` SVG in a 0-100 coordinate space
 * laid under HTML axis labels, so the geometry stretches with the container
 * while type stays at a readable size. Everything the first paint needs is
 * derived from props, so the server render is already the finished chart —
 * hover, keyboard read-out and the range toggle layer on after hydration.
 */
export function PerformanceChart({ agent, className }: PerformanceChartProps) {
  const category = CATEGORY_MAP[agent.category];
  const accent = category.accentHex;
  // Deterministic id (one chart per agent page) so SSR and client markup match
  // and the SVG fragment reference stays a plain, selector-safe token.
  const gradientId = `perf-grad-${agent.id}`;

  const [range, setRange] = useState<RangeKey>('30D');
  const [active, setActive] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  const view = useMemo(() => {
    const points = range === '7D' ? 7 : 30;
    const data = agent.sparkline.slice(-points);
    const rawLo = Math.min(...data);
    const rawHi = Math.max(...data);
    const spread = rawHi - rawLo || Math.max(1, rawHi * 0.01);
    const lo = rawLo - spread * 0.18;
    const hi = rawHi + spread * 0.18;
    const span = hi - lo;

    const x = (i: number) => (data.length === 1 ? 50 : (i / (data.length - 1)) * 100);
    const y = (v: number) => clamp((1 - (v - lo) / span) * 100, 0, 100);

    const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(3)},${y(v).toFixed(3)}`).join(' ');
    const areaPath = `${line} L100,100 L0,100 Z`;

    const gridValues = Array.from({ length: 5 }, (_, k) => hi - (span * k) / 4);
    const ticks = tickIndices(data.length, data.length <= 7 ? 4 : 5);

    const first = data[0];
    const last = data[data.length - 1];
    const change = ((last - first) / first) * 100;

    return { data, lo, hi, span, x, y, line, areaPath, gridValues, ticks, first, last, change };
  }, [agent.sparkline, range]);

  const { data, x, y, first, last, change } = view;
  const up = change >= 0;
  const activeValue = active === null ? undefined : data[active];
  const activeDelta = activeValue === undefined ? null : ((activeValue - first) / first) * 100;

  const pickFromPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const box = plotRef.current?.getBoundingClientRect();
      if (!box || box.width === 0) return;
      const ratio = (event.clientX - box.left) / box.width;
      setActive(clamp(Math.round(ratio * (data.length - 1)), 0, data.length - 1));
    },
    [data.length],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const lastIndex = data.length - 1;
      let next: number | null = null;
      if (event.key === 'ArrowRight') next = active === null ? 0 : Math.min(active + 1, lastIndex);
      else if (event.key === 'ArrowLeft') next = active === null ? lastIndex : Math.max(active - 1, 0);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = lastIndex;
      else if (event.key === 'Escape') {
        setActive(null);
        return;
      } else return;
      event.preventDefault();
      setActive(next);
    },
    [active, data.length],
  );

  const summary =
    active === null || activeValue === undefined
      ? `${agent.name} equity curve, ${range}, base 100. Now ${last.toFixed(2)}, ${formatPct(change)} over the range. Use the arrow keys to read individual days.`
      : `${dayLabel(active, data.length)}: ${activeValue.toFixed(2)}, ${formatPct(activeDelta ?? 0)} from the start of the range.`;

  const tipX = clamp(x(active ?? 0), 14, 86);
  const tipY = y(activeValue ?? last);
  const tipBelow = tipY < 32;

  return (
    <div className={cn('rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-xl sm:p-5', className)}>
      {/* header: current level + range toggle */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Equity curve · base 100
          </div>
          <div className="mt-1 flex items-baseline gap-2.5">
            <span className="tabular text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {last.toFixed(2)}
            </span>
            <span
              className={cn(
                'tabular inline-flex items-center gap-1 text-sm font-semibold',
                up ? 'text-emerald-300' : 'text-rose-300',
              )}
            >
              {up ? <TrendingUp className="h-4 w-4" aria-hidden /> : <TrendingDown className="h-4 w-4" aria-hidden />}
              {formatPct(change)}
            </span>
            <span className="text-xs text-slate-500">over {range === '7D' ? '7 days' : '30 days'}</span>
          </div>
        </div>

        <div
          role="group"
          aria-label="Chart range"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1"
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                setRange(r.key);
                setActive(null);
              }}
              aria-pressed={range === r.key}
              title={r.label}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-200 ring-focus',
                range === r.key ? 'bg-bnb text-ink' : 'text-slate-400 hover:text-white',
              )}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>

      {/* plot */}
      <div className="mt-4 pl-11">
        <div ref={plotRef} className="relative h-[200px] sm:h-[248px]">
          {/* y gridlines + labels */}
          {view.gridValues.map((value, i) => (
            <div
              key={i}
              aria-hidden
              className="absolute inset-x-0 flex items-center"
              style={{ top: `${(i / (view.gridValues.length - 1)) * 100}%` }}
            >
              <span className="tabular absolute -left-11 w-10 -translate-y-1/2 pr-2 text-right font-mono text-[10px] text-slate-600">
                {value.toFixed(1)}
              </span>
              <span className="h-px w-full bg-white/[0.055]" />
            </div>
          ))}

          {/* area + line */}
          <svg
            className="absolute inset-0 h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
            focusable="false"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.38" />
                <stop offset="60%" stopColor={accent} stopOpacity="0.10" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={view.areaPath} fill={`url(#${gradientId})`} />
            <path
              d={view.line}
              fill="none"
              stroke={accent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {active !== null && (
              <line
                x1={x(active)}
                x2={x(active)}
                y1={0}
                y2={100}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth={1}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* latest point marker */}
          <span
            aria-hidden
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-ink"
            style={{ left: '100%', top: `${y(last)}%`, background: accent }}
          />

          {/* hovered point marker */}
          {active !== null && activeValue !== undefined && (
            <span
              aria-hidden
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink"
              style={{ left: `${x(active)}%`, top: `${y(activeValue)}%`, background: accent, boxShadow: `0 0 0 3px ${accent}33` }}
            />
          )}

          {/* tooltip */}
          {active !== null && activeValue !== undefined && (
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute z-10 min-w-[7.5rem] -translate-x-1/2 rounded-lg border border-white/[0.12] bg-ink/95 px-2.5 py-2 shadow-card backdrop-blur-xl',
                tipBelow ? 'translate-y-3' : '-translate-y-[calc(100%+0.75rem)]',
              )}
              style={{ left: `${tipX}%`, top: `${tipY}%` }}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                {dayLabel(active, data.length)}
              </div>
              <div className="tabular mt-0.5 text-sm font-semibold text-white">{activeValue.toFixed(2)}</div>
              <div
                className={cn(
                  'tabular text-[11px] font-medium',
                  (activeDelta ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300',
                )}
              >
                {formatPct(activeDelta ?? 0)} vs {dayLabel(0, data.length)}
              </div>
            </div>
          )}

          {/* interaction surface: pointer + keyboard */}
          <div
            role="img"
            tabIndex={0}
            aria-label={summary}
            onPointerMove={pickFromPointer}
            onPointerDown={pickFromPointer}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 cursor-crosshair rounded-lg ring-focus"
          />
        </div>

        {/* x labels */}
        <div className="relative mt-2 h-4" aria-hidden>
          {view.ticks.map((i) => (
            <span
              key={i}
              className={cn(
                'tabular absolute top-0 whitespace-nowrap font-mono text-[10px] text-slate-600',
                i === 0 && 'translate-x-0',
                i === data.length - 1 && '-translate-x-full',
                i !== 0 && i !== data.length - 1 && '-translate-x-1/2',
              )}
              style={{ left: `${x(i)}%` }}
            >
              {dayLabel(i, data.length)}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-snug text-slate-500">
        Indexed daily settlement values reconstructed from the agent&apos;s on-chain telemetry, normalised to 100 at the
        start of the window. Past performance is not a guarantee of future results.
      </p>
    </div>
  );
}
