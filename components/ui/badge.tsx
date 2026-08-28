import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'gold' | 'cyan' | 'emerald' | 'violet' | 'rose' | 'slate' | 'sky';

const tones: Record<BadgeTone, string> = {
  gold: 'bg-bnb/10 text-bnb border-bnb/30',
  cyan: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',
  emerald: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
  violet: 'bg-violet-400/10 text-violet-300 border-violet-400/30',
  rose: 'bg-rose-400/10 text-rose-300 border-rose-400/30',
  sky: 'bg-sky-400/10 text-sky-300 border-sky-400/30',
  slate: 'bg-white/[0.06] text-slate-300 border-white/10',
};

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
  size?: 'sm' | 'md';
  title?: string;
}

export function Badge({ tone = 'slate', icon, className, children, size = 'sm', title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
