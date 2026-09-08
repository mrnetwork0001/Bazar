'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Mini table of contents for the API reference. Progressive enhancement: the
 * links are plain in-page anchors and work with JavaScript off; the scroll spy
 * only adds the active highlight.
 */

export interface TocItem {
  id: string;
  label: string;
}

export function DocsToc({ items, className }: { items: TocItem[]; className?: string }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = items.find((item) => visible.has(item.id));
        if (first) setActive(first.id);
      },
      // Activate a heading once it reaches the top third of the viewport.
      { rootMargin: '-88px 0px -66% 0px', threshold: 0 },
    );

    const nodes = items
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => node !== null);
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      aria-label="On this page"
      // Sticky under the navbar rather than fixed to the viewport: Bazar has a
      // top bar carrying the logo, so a full-height rail would sit under it and
      // repeat the brand. This starts below it and travels with the scroll.
      className={cn(
        'sticky top-24 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-2 backdrop-blur-xl',
        // Nine screens of reference will outgrow a short viewport before the
        // list does; scroll the rail rather than clipping it.
        'max-h-[calc(100vh-8rem)] overflow-y-auto',
        className,
      )}
    >
      <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        API reference
      </p>
      <ul className="space-y-0.5">
        {items.map((item, i) => {
          const current = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? 'true' : undefined}
                className={cn(
                  'ring-focus flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
                  current
                    ? 'bg-bnb/[0.12] font-medium text-bnb'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100',
                )}
              >
                <span
                  className={cn(
                    'tabular w-4 shrink-0 text-[11px]',
                    current ? 'text-bnb/70' : 'text-slate-600',
                  )}
                  aria-hidden
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
