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
    <nav aria-label="On this page" className={cn('sticky top-24', className)}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">On this page</p>
      <ul className="mt-3 space-y-0.5 border-l border-white/[0.08]">
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? 'true' : undefined}
                className={cn(
                  '-ml-px block border-l py-1.5 pl-3 text-[13px] transition-colors ring-focus',
                  current
                    ? 'border-bnb font-medium text-bnb'
                    : 'border-transparent text-slate-500 hover:border-white/20 hover:text-slate-200',
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
