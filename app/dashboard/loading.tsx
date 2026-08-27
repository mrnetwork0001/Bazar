import { Skeleton } from '@/components/marketplace/skeletons';

/** Route-level skeleton mirroring the dashboard layout. Uses the shared `.shimmer` placeholder. */
export default function DashboardLoading() {
  return (
    <div className="container-x pb-24 pt-10 sm:pt-14" aria-busy="true" aria-label="Loading dashboard">
      {/* header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl flex-1">
          <Skeleton className="h-6 w-52 rounded-full" />
          <Skeleton className="mt-4 h-10 w-72 sm:w-96" />
          <Skeleton className="mt-4 h-4 w-full max-w-xl" />
          <Skeleton className="mt-2 h-4 w-3/4 max-w-lg" />
        </div>
        <Skeleton className="h-[104px] w-full rounded-2xl sm:w-[300px]" />
      </div>

      <Skeleton className="mt-6 h-[76px] w-full rounded-2xl" />

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,330px)] lg:items-start lg:gap-6 xl:gap-8">
        <div className="min-w-0">
          {/* summary tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px] rounded-2xl" />
            ))}
          </div>

          {/* tabs */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Skeleton className="h-10 w-full max-w-[420px] rounded-xl" />
            <Skeleton className="hidden h-4 w-32 sm:block" />
          </div>

          {/* table */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            <div className="border-b border-white/[0.08] bg-white/[0.02] px-4 py-3">
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="divide-y divide-white/[0.06]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20 rounded-full" />
                  </div>
                  <Skeleton className="hidden h-3.5 w-20 sm:block" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="hidden h-2 w-24 rounded-full lg:block" />
                  <Skeleton className="hidden h-3.5 w-16 xl:block" />
                  <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* right rail */}
        <div className="mt-6 space-y-6 lg:mt-0">
          <Skeleton className="h-[420px] w-full rounded-2xl" />
          <Skeleton className="h-[360px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
