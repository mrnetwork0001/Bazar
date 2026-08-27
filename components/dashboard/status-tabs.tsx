'use client';

import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { DASHBOARD_TABS, type DashboardTab } from './hire-helpers';

export interface StatusTabsProps {
  value: DashboardTab;
  onChange: (tab: DashboardTab) => void;
  counts: Record<DashboardTab, number>;
  className?: string;
}

export function StatusTabs({ value, onChange, counts, className }: StatusTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = Math.max(0, DASHBOARD_TABS.findIndex((t) => t.id === value));
    const last = DASHBOARD_TABS.length - 1;
    let next = idx;
    if (e.key === 'ArrowRight') next = idx === last ? 0 : idx + 1;
    else if (e.key === 'ArrowLeft') next = idx === 0 ? last : idx - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    onChange(DASHBOARD_TABS[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Filter hires by status"
      onKeyDown={onKeyDown}
      className={cn('glass inline-flex max-w-full gap-1 overflow-x-auto rounded-xl p-1', className)}
    >
      {DASHBOARD_TABS.map((tab, i) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`hires-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls="hires-panel"
            tabIndex={selected ? 0 : -1}
            title={tab.hint}
            onClick={() => onChange(tab.id)}
            className={cn(
              'ring-focus inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors duration-200',
              selected
                ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
            )}
          >
            {tab.label}
            <span
              className={cn(
                'rounded-md px-1.5 py-px font-mono text-[10px] tabular',
                selected ? 'bg-bnb/15 text-bnb' : 'bg-white/[0.06] text-slate-500',
              )}
            >
              {counts[tab.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
