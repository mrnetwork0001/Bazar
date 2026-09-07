import { AgentCardSkeleton, Skeleton } from '@/components/marketplace/skeletons';

/**
 * Route skeleton for the PancakeSwap lane.
 *
 * The lane is five parallel listing queries against 8004scan plus the chain's
 * agent count, and the index answers each in roughly two seconds, so a cold
 * render is genuinely slow enough to need this. The shape mirrors the real
 * page - header, the measurement panel, then the first shelf - so nothing
 * jumps when the data lands.
 */
export default function PancakeSwapLaneLoading() {
  return (
    <main className="container-x pb-24 pt-10 sm:pt-14" aria-busy="true" aria-label="Reading the ERC-8004 index">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div className="max-w-2xl">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-48 rounded-full" />
            <Skeleton className="h-6 w-40 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-11 w-full max-w-xl" />
          <Skeleton className="mt-2 h-11 w-2/3 max-w-md" />
          <Skeleton className="mt-5 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-full max-w-lg" />
          <Skeleton className="mt-2 h-4 w-3/4 max-w-md" />
        </div>
        <Skeleton className="h-[86px] w-full rounded-2xl" />
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
        <Skeleton className="h-[420px] w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[260px] w-full rounded-2xl" />
          <Skeleton className="h-[260px] w-full rounded-2xl" />
        </div>
      </div>

      <div className="mt-16 border-t border-white/[0.08] pt-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-5 w-full max-w-xl" />
        <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <AgentCardSkeleton />
              <Skeleton className="mt-2 h-[104px] w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
