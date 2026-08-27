import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

function Block({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div aria-hidden style={style} className={cn('relative overflow-hidden rounded-md bg-white/[0.05]', className)}>
      <div className="shimmer absolute inset-0" />
    </div>
  );
}

/** Route-level skeleton for /agents/[id]; mirrors the real two-column layout. */
export default function AgentLoading() {
  return (
    <div className="container-x pb-24 pt-6 sm:pt-8" aria-busy="true" aria-label="Loading agent">
      <Block className="h-4 w-64" />

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          {/* header */}
          <div>
            <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
              <Block className="h-20 w-20 shrink-0 rounded-2xl sm:h-24 sm:w-24" />
              <div className="min-w-0 flex-1 space-y-3">
                <Block className="h-9 w-2/3 max-w-sm" />
                <Block className="h-4 w-1/2 max-w-xs" />
                <Block className="h-5 w-full max-w-lg" />
                <Block className="h-4 w-full" />
                <Block className="h-4 w-11/12" />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[128, 96, 88, 72].map((width) => (
                    <Block key={width} className="h-6 rounded-full" style={{ width }} />
                  ))}
                </div>
              </div>
            </div>
            <Block className="mt-6 h-[68px] w-full rounded-2xl lg:h-[60px]" />
          </div>

          {/* performance */}
          <div className="space-y-4">
            <Block className="h-6 w-40" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Block className="col-span-2 h-[176px] rounded-2xl" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Block key={i} className="h-[116px] rounded-2xl" />
              ))}
            </div>
            <Block className="h-[340px] w-full rounded-2xl" />
          </div>

          {/* trust stack */}
          <div className="space-y-4">
            <Block className="h-6 w-56" />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Block key={i} className="h-[264px] rounded-2xl" />
              ))}
            </div>
          </div>

          {/* pricing */}
          <div className="space-y-4">
            <Block className="h-6 w-48" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Block key={i} className="h-[320px] rounded-2xl" />
              ))}
            </div>
          </div>
        </div>

        {/* rail */}
        <div className="min-w-0 space-y-6">
          <Block className="h-[336px] w-full rounded-2xl" />
          <div className="space-y-2.5">
            <Block className="h-3 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Block key={i} className="h-[68px] w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
