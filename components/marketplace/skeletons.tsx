import { cn } from '@/lib/utils';

/** Shimmering placeholder block. Server-safe. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('relative overflow-hidden rounded-md bg-white/[0.05]', className)}>
      <div className="shimmer absolute inset-0" />
    </div>
  );
}

const TAB_WIDTHS = [124, 140, 132, 168, 132];

export function TabsSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden" aria-hidden>
      {TAB_WIDTHS.map((w, i) => (
        <div key={i} style={{ width: w }} className="shrink-0">
          <Skeleton className="h-10 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function ControlSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-10 rounded-xl', className)} />;
}

/** Mirrors the geometry of `AgentCard`: identity, description, reputation block, chips, footer. */
export function AgentCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5" aria-hidden>
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-4/5" />
      <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <Skeleton className="mt-2 h-6 w-20" />
        <Skeleton className="mt-3 h-1 w-full rounded-full" />
        <Skeleton className="mt-3 h-2.5 w-40" />
      </div>
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}
