'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import type { BadgeId, Protocol } from '@/lib/types';
import { ALL_PROTOCOLS } from '@/lib/data/agents';
import { BADGE_META } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BADGE_ORDER,
  SLA_CEIL,
  SLA_FLOOR,
  SLA_PRESETS,
  SLA_STEP,
  countPanelFilters,
  parseBadges,
  parseMinSla,
  parseProtocols,
  type FilterFacets,
} from './marketplace-config';
import { useMarketplaceParams } from './use-marketplace-params';

const TONE_TEXT: Record<string, string> = {
  gold: 'text-bnb',
  cyan: 'text-cyan-300',
  emerald: 'text-emerald-300',
  violet: 'text-violet-300',
  rose: 'text-rose-300',
  sky: 'text-sky-300',
  slate: 'text-slate-300',
};

/* ------------------------------ primitives ------------------------------ */

function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</h3>
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  count,
  icon,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count: number;
  icon?: ReactNode;
}) {
  return (
    <label
      className={cn(
        'group flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]',
        checked && 'bg-white/[0.03]',
      )}
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-white/20 bg-white/[0.04] transition-colors checked:border-bnb checked:bg-bnb ring-focus"
        />
        <Check className="pointer-events-none absolute h-3 w-3 text-ink opacity-0 peer-checked:opacity-100" strokeWidth={3} aria-hidden />
      </span>
      {icon}
      <span className={cn('flex-1 truncate text-sm', checked ? 'text-white' : 'text-slate-300 group-hover:text-white')}>{label}</span>
      <span className={cn('tabular shrink-0 text-xs', count === 0 ? 'text-slate-600' : 'text-slate-500')}>{count}</span>
    </label>
  );
}

/* --------------------------------- panel -------------------------------- */

export interface FiltersPanelProps {
  facets: FilterFacets;
  /** Show the "Filters" heading with active count + reset (desktop sidebar). */
  showHeader?: boolean;
  className?: string;
}

/**
 * Badge checklist, protocol checklist and minimum SLA slider, bound to
 * `?badge=`, `?protocol=` and `?minSla=`. Render inside `<Suspense>`.
 */
export function FiltersPanel({ facets, showHeader, className }: FiltersPanelProps) {
  const { searchParams, set } = useMarketplaceParams();
  const badges = parseBadges(searchParams.getAll('badge'));
  const protocols = parseProtocols(searchParams.getAll('protocol'));
  const minSla = parseMinSla(searchParams.get('minSla'));
  const activeCount = countPanelFilters({ badges, protocols, minSla });

  const setRef = useRef(set);
  useEffect(() => {
    setRef.current = set;
  }, [set]);

  // Slider: local value for smooth dragging, URL update debounced.
  const urlSla = minSla ?? SLA_FLOOR;
  const [sla, setSla] = useState(urlSla);
  const syncedSla = useRef(urlSla);

  useEffect(() => {
    if (urlSla !== syncedSla.current) {
      syncedSla.current = urlSla;
      setSla(urlSla);
    }
  }, [urlSla]);

  useEffect(() => {
    if (sla === syncedSla.current) return;
    const timer = setTimeout(() => {
      syncedSla.current = sla;
      setRef.current({ minSla: sla > SLA_FLOOR ? String(sla) : null });
    }, 250);
    return () => clearTimeout(timer);
  }, [sla]);

  const toggleBadge = (b: BadgeId) => {
    const next = badges.includes(b) ? badges.filter((x) => x !== b) : [...badges, b];
    set({ badge: next.length ? next.join(',') : null });
  };

  const toggleProtocol = (p: Protocol) => {
    const next = protocols.includes(p) ? protocols.filter((x) => x !== p) : [...protocols, p];
    set({ protocol: next.length ? next.join(',') : null });
  };

  const reset = () => set({ badge: null, protocol: null, minSla: null });

  return (
    <div className={cn('space-y-6', className)}>
      {showHeader && (
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" aria-hidden />
            Filters
            {activeCount > 0 && (
              <span className="tabular rounded-md bg-bnb/15 px-1.5 py-0.5 text-[11px] font-semibold text-bnb">{activeCount}</span>
            )}
          </h2>
          <button
            type="button"
            onClick={reset}
            disabled={activeCount === 0}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-400 transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-40 ring-focus"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Reset
          </button>
        </div>
      )}

      <section aria-labelledby="filter-badges">
        <SectionTitle hint="match all">
          <span id="filter-badges">Badges</span>
        </SectionTitle>
        <ul role="list" className="mt-2 -mx-2 space-y-0.5">
          {BADGE_ORDER.map((id) => {
            const meta = BADGE_META[id];
            const Icon = meta.icon;
            return (
              <li key={id}>
                <CheckRow
                  checked={badges.includes(id)}
                  onChange={() => toggleBadge(id)}
                  label={meta.label}
                  count={facets.badges[id] ?? 0}
                  icon={<Icon className={cn('h-3.5 w-3.5 shrink-0', TONE_TEXT[meta.tone])} aria-hidden />}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="filter-protocols">
        <SectionTitle hint="match any">
          <span id="filter-protocols">Protocols</span>
        </SectionTitle>
        <ul role="list" className="mt-2 -mx-2 space-y-0.5">
          {ALL_PROTOCOLS.map((p) => (
            <li key={p}>
              <CheckRow checked={protocols.includes(p)} onChange={() => toggleProtocol(p)} label={p} count={facets.protocols[p] ?? 0} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="filter-sla">
        <SectionTitle>
          <span id="filter-sla">Min SLA score</span>
        </SectionTitle>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">Adherence over the last 30 days</span>
          <span className={cn('tabular font-mono text-xs font-semibold', sla > SLA_FLOOR ? 'text-bnb' : 'text-slate-400')}>
            {sla > SLA_FLOOR ? `≥ ${sla.toFixed(1)}%` : 'Any'}
          </span>
        </div>
        <input
          type="range"
          min={SLA_FLOOR}
          max={SLA_CEIL}
          step={SLA_STEP}
          value={sla}
          onChange={(e) => setSla(Number(e.target.value))}
          aria-label="Minimum SLA score"
          aria-valuemin={SLA_FLOOR}
          aria-valuemax={SLA_CEIL}
          aria-valuenow={sla}
          aria-valuetext={sla > SLA_FLOOR ? `at least ${sla.toFixed(1)} percent` : 'any SLA score'}
          className="mt-3 h-1.5 w-full cursor-pointer rounded-full ring-focus"
          style={{ accentColor: '#F0B90B' }}
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-500" aria-hidden>
          <span>{SLA_FLOOR}</span>
          <span>95</span>
          <span>{SLA_CEIL}</span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {SLA_PRESETS.map((preset) => {
            const active = sla === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setSla(active ? SLA_FLOOR : preset)}
                aria-pressed={active}
                className={cn(
                  'tabular h-7 flex-1 rounded-lg border text-xs font-medium transition-colors ring-focus',
                  active
                    ? 'border-bnb/50 bg-bnb/15 text-bnb'
                    : 'border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/20 hover:text-white',
                )}
              >
                {`≥ ${preset}`}
              </button>
            );
          })}
        </div>
      </section>

      {!showHeader && activeCount > 0 && (
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-white ring-focus rounded"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Reset filters
        </button>
      )}
    </div>
  );
}

/* ------------------------------ mobile drawer --------------------------- */

/**
 * "Filters" button (mobile / tablet) that opens `FiltersPanel` in a drawer.
 * Escape closes, focus moves into the dialog and returns to the trigger on close.
 * Render inside `<Suspense>`.
 */
export function FiltersButton({ facets, className }: { facets: FilterFacets; className?: string }) {
  const { searchParams } = useMarketplaceParams();
  const activeCount = countPanelFilters({
    badges: parseBadges(searchParams.getAll('badge')),
    protocols: parseProtocols(searchParams.getAll('protocol')),
    minSla: parseMinSla(searchParams.get('minSla')),
  });

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 30);
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-medium text-slate-300 backdrop-blur-xl',
          'transition-colors hover:border-white/20 hover:text-white ring-focus',
          className,
        )}
      >
        <SlidersHorizontal className="h-4 w-4 text-slate-400" aria-hidden />
        Filters
        {activeCount > 0 && (
          <span className="tabular rounded-md bg-bnb/15 px-1.5 py-0.5 text-[11px] font-semibold text-bnb">{activeCount}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="filters-drawer"
            className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Filter agents"
              className={cn(
                'relative flex max-h-[88vh] w-full flex-col rounded-t-2xl border border-white/[0.1] bg-surface shadow-card',
                'sm:h-full sm:max-h-none sm:w-[360px] sm:rounded-none sm:border-y-0 sm:border-r-0',
              )}
              initial={{ y: 32, opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 32, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
                <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  <SlidersHorizontal className="h-4 w-4 text-slate-400" aria-hidden />
                  Filters
                  {activeCount > 0 && (
                    <span className="tabular rounded-md bg-bnb/15 px-1.5 py-0.5 text-[11px] font-semibold text-bnb">{activeCount}</span>
                  )}
                </h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close filters"
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white ring-focus"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <FiltersPanel facets={facets} />
              </div>
              <div className="border-t border-white/[0.08] px-5 py-4">
                <Button variant="primary" size="md" className="w-full" onClick={() => setOpen(false)}>
                  Show results
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
