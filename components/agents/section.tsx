import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface AgentSectionProps {
  id: string;
  title: string;
  description?: string;
  /** Right-aligned slot in the section header (badges, toggles). */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Titled section used down the main column of the agent detail page.
 * Server-safe; the heading id doubles as an in-page anchor target.
 */
export function AgentSection({ id, title, description, aside, className, children }: AgentSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn('scroll-mt-24', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-heading`} className="text-lg font-semibold tracking-tight text-white sm:text-xl">
            {title}
          </h2>
          {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>}
        </div>
        {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
