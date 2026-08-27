import { AgentCardSkeleton, ControlSkeleton, FiltersSkeleton, Skeleton, TabsSkeleton } from '@/components/marketplace/skeletons';

/** Route-level skeleton shown while the marketplace page renders. */
export default function MarketplaceLoading() {
  return (
    <main className="container-x pb-24 pt-10 sm:pt-14" aria-busy="true" aria-label="Loading marketplace">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-48 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-10 w-72 sm:w-96" />
          <Skeleton className="mt-4 h-4 w-full max-w-xl" />
          <Skeleton className="mt-2 h-4 w-3/4 max-w-lg" />
        </div>
        <Skeleton className="h-[74px] w-full rounded-2xl lg:w-[440px]" />
      </div>

      <div className="mt-8">
        <TabsSkeleton />
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[260px_1fr] lg:items-start lg:gap-8">
        <aside className="hidden lg:block">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <FiltersSkeleton />
          </div>
        </aside>
        <section className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ControlSkeleton className="flex-1" />
            <div className="flex gap-2">
              <ControlSkeleton className="w-40" />
              <ControlSkeleton className="w-44" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="hidden h-4 w-56 sm:block" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
