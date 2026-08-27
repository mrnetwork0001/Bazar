import { cn } from '@/lib/utils';

/** Shimmering placeholder block. Server-safe. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('relative overflow-hidden rounded-md bg-white/[0.05]', className)}>
      <div className="shimmer absolute inset-0" />
    </div>
  );
}

export function TabsSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden" aria-hidden>
      {[112, 132, 128, 128, 152].map((w, i) => (
        <Skeleton key={i} className="h-10 shrink-0 rounded-xl" />
      )).map((el, i) => (
        <div key={i} style={{ width: [112, 132, 128, 128, 152][i] }} className="shrink-0">
          {el}
        </div>
      ))}
    </div>
  );
}

export function ControlSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-10 rounded-xl', className)} />;
}

export function FiltersSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-4 w-24" />
      <div className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      <Skeleton className="h-4 w-20" />
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

export function AgentCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5" aria-hidden>
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-4/5" />
      <div className="mt-5 flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-7 w-24" />
        </div>
        <Skeleton className="h-9 w-[120px]" />
      </div>
      <Skeleton className="mt-4 h-12 w-full rounded-xl" />
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}
