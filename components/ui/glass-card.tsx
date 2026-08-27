import { forwardRef, type ElementType, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  strong?: boolean;
  padded?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { className, hover, strong, padded = true, as: Tag = 'div', ...props },
  ref,
) {
  // `as` widens the rendered element; ElementType lets the div-shaped props spread cleanly.
  const Component = Tag as ElementType;

  return (
    <Component
      ref={ref}
      className={cn(
        'rounded-2xl shadow-card',
        strong ? 'glass-strong' : 'glass',
        hover && 'glass-hover',
        padded && 'p-5',
        className,
      )}
      {...props}
    />
  );
});
