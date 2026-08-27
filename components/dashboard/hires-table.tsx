'use client';

import type { Hire } from '@/lib/types';
import { cn } from '@/lib/utils';
import { HIRE_COLUMNS, HireRow } from './hire-row';
import { resolveHire } from './hire-helpers';

export interface HiresTableProps {
  hires: Hire[];
  className?: string;
  /** Caption announced to screen readers above the table. */
  caption?: string;
}

/**
 * Responsive hire ledger: a real `<table>` from md up, stacked cards below it.
 * Each row/card owns its expanded escrow panel (see `HireRow`).
 */
export function HiresTable({ hires, className, caption = 'Your hires and their escrow state' }: HiresTableProps) {
  const rows = hires.map(resolveHire);

  return (
    <div className={cn('min-w-0', className)}>
      {/* mobile: stacked cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((resolved) => (
          <HireRow key={`card-${resolved.hire.id}`} resolved={resolved} variant="card" />
        ))}
      </ul>

      {/* md+: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-card backdrop-blur-xl md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                {HIRE_COLUMNS.map((col) => (
                  <th
                    key={col.id}
                    scope="col"
                    className={cn(
                      'whitespace-nowrap px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-slate-500',
                      col.className,
                    )}
                  >
                    {col.srOnly ? <span className="sr-only">{col.label}</span> : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((resolved) => (
                <HireRow key={`row-${resolved.hire.id}`} resolved={resolved} variant="row" />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
