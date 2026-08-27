'use client';

import Link from 'next/link';
import { LayoutGrid, type LucideIcon } from 'lucide-react';
import type { CategoryId } from '@/lib/types';
import { CATEGORIES, isCategoryId } from '@/lib/data/categories';
import { cn } from '@/lib/utils';
import { BNB_HEX, CATEGORY_ICONS, withAlpha, type CategoryCounts } from './marketplace-config';
import { useMarketplaceParams } from './use-marketplace-params';

interface Tab {
  id: CategoryId | 'all';
  name: string;
  icon: LucideIcon;
  hex: string;
}

const TABS: Tab[] = [
  { id: 'all', name: 'All agents', icon: LayoutGrid, hex: BNB_HEX },
  ...CATEGORIES.map<Tab>((c) => ({ id: c.id, name: c.name, icon: CATEGORY_ICONS[c.icon], hex: c.accentHex })),
];

/**
 * URL-driven category tabs (`?category=`). Links preserve every other param.
 * Render inside `<Suspense>`.
 */
export function CategoryTabs({ counts }: { counts: CategoryCounts }) {
  const { searchParams, href } = useMarketplaceParams();
  const current = searchParams.get('category');
  const active: CategoryId | 'all' = isCategoryId(current) ? current : 'all';

  return (
    <nav
      aria-label="Agent categories"
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul role="list" className="flex min-w-max gap-2">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;
          return (
            <li key={tab.id}>
              <Link
                href={href({ category: tab.id === 'all' ? null : tab.id })}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors duration-200 ring-focus',
                  isActive
                    ? 'shadow-sm'
                    : 'border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/[0.05] hover:text-white',
                )}
                style={
                  isActive
                    ? { borderColor: withAlpha(tab.hex, 0.45), background: withAlpha(tab.hex, 0.12), color: tab.hex }
                    : undefined
                }
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="whitespace-nowrap">{tab.name}</span>
                <span
                  className={cn(
                    'tabular rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none',
                    isActive ? 'bg-ink/50 text-inherit' : 'bg-white/[0.06] text-slate-400',
                  )}
                  aria-label={`${counts[tab.id]} agents`}
                >
                  {counts[tab.id]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
