'use client';

import { Gauge, Network, Search, X, type LucideIcon } from 'lucide-react';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { BADGE_META } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { A2A_ACCENT_HEX, hasActiveFilters, parseMarketplaceParams, rawFromSearchParams, withAlpha } from './marketplace-config';
import { useMarketplaceParams } from './use-marketplace-params';

interface Chip {
  key: string;
  label: string;
  icon?: LucideIcon;
  hex?: string;
  onRemove: () => void;
}

/** Removable chips for every active filter plus "Clear all". Renders nothing when idle. Render inside `<Suspense>`. */
export function ActiveFilters({ className }: { className?: string }) {
  const { searchParams, set, clearAll } = useMarketplaceParams();
  const params = parseMarketplaceParams(rawFromSearchParams(searchParams));
  if (!hasActiveFilters(params)) return null;

  const chips: Chip[] = [];

  if (params.category) {
    const category = CATEGORY_MAP[params.category];
    chips.push({ key: 'category', label: category.name, hex: category.accentHex, onRemove: () => set({ category: null }) });
  }
  if (params.q) {
    chips.push({ key: 'q', label: `“${params.q}”`, icon: Search, onRemove: () => set({ q: null }) });
  }
  if (params.a2aOnly) {
    chips.push({ key: 'a2a', label: 'A2A-ready', icon: Network, hex: A2A_ACCENT_HEX, onRemove: () => set({ a2a: null }) });
  }
  for (const badge of params.badges) {
    const meta = BADGE_META[badge];
    const rest = params.badges.filter((b) => b !== badge);
    chips.push({ key: `badge:${badge}`, label: meta.label, icon: meta.icon, onRemove: () => set({ badge: rest.length ? rest.join(',') : null }) });
  }
  for (const protocol of params.protocols) {
    const rest = params.protocols.filter((p) => p !== protocol);
    chips.push({ key: `protocol:${protocol}`, label: protocol, onRemove: () => set({ protocol: rest.length ? rest.join(',') : null }) });
  }
  if (params.minSla !== undefined) {
    chips.push({ key: 'minSla', label: `SLA ≥ ${params.minSla.toFixed(1)}%`, icon: Gauge, onRemove: () => set({ minSla: null }) });
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} role="region" aria-label="Active filters">
      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove filter: ${chip.label}`}
            className={cn(
              'group inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] pl-2.5 pr-1.5 text-xs font-medium text-slate-200',
              'transition-colors hover:border-white/25 hover:bg-white/[0.07] ring-focus',
            )}
            style={chip.hex ? { borderColor: withAlpha(chip.hex, 0.35), color: chip.hex, background: withAlpha(chip.hex, 0.08) } : undefined}
          >
            {Icon && <Icon className="h-3 w-3 opacity-80" aria-hidden />}
            <span className="max-w-[180px] truncate">{chip.label}</span>
            <X className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden />
          </button>
        );
      })}
      <button
        type="button"
        onClick={clearAll}
        className="ml-1 rounded text-xs text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline ring-focus"
      >
        Clear all
      </button>
    </div>
  );
}
