import { Skeleton } from '@/components/marketplace/skeletons';

/**
 * Route-level skeleton, kept in step with `dashboard-view`: header plus wallet
 * card, four summary tiles, a stack of job cards, and a right rail carrying the
 * scan report, the job-id lookup and the settlement contracts.
 *
 * It intentionally mirrors the connected layout. The disconnected state renders
 * almost immediately (no chain read happens until a wallet is known), so a
 * skeleton shaped like the empty state would flash a layout the visitor never
 * arrives at.
 */
export default function DashboardLoading() {
  return (
    <div className="container-x pb-24 pt-10 sm:pt-14" aria-busy="true" aria-label="Loading dashboard">
      {/* header + wallet card */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl flex-1">
          <Skeleton className="h-6 w-64 rounded-full" />
          <Skeleton className="mt-4 h-10 w-64 sm:w-80" />
          <Skeleton className="mt-4 h-4 w-full max-w-xl" />
          <Skeleton className="mt-2 h-4 w-3/4 max-w-lg" />
        </div>
        <Skeleton className="h-[232px] w-full rounded-2xl lg:w-[340px]" />
      </div>

      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start lg:gap-6 xl:gap-8">
        <div className="min-w-0">
          {/* summary tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[112px] rounded-2xl" />
            ))}
          </div>

          {/* section heading + refresh */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-52" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>

          {/* job cards */}
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[176px] rounded-2xl" />
            ))}
          </div>
        </div>

        {/* right rail: scan report, job lookup, settlement contracts */}
        <div className="mt-6 space-y-6 lg:mt-0">
          <Skeleton className="h-[360px] w-full rounded-2xl" />
          <Skeleton className="h-[164px] w-full rounded-2xl" />
          <Skeleton className="h-[380px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
