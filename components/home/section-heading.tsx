import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: { href: string; label: string };
  align?: 'left' | 'center';
  className?: string;
  as?: 'h2' | 'h3';
  id?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = 'left',
  className,
  as: Tag = 'h2',
  id,
}: SectionHeadingProps) {
  const centered = align === 'center';
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        centered && 'items-center text-center sm:flex-col sm:items-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', centered && 'mx-auto')}>
        {eyebrow && (
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-bnb">{eyebrow}</p>
        )}
        <Tag id={id} className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {title}
        </Tag>
        {description && (
          <p className="mt-3 text-base leading-relaxed text-slate-400 sm:text-lg">{description}</p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-md text-sm font-medium text-bnb ring-focus hover:text-bnb-300"
        >
          {action.label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
