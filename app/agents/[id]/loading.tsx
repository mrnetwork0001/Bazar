import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

function Block({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div aria-hidden style={style} className={cn('relative overflow-hidden rounded-md bg-white/[0.05]', className)}>
      <div className="shimmer absolute inset-0" />
    </div>
  );
}

/**
 * Route-level skeleton for /agents/[id].
 *
 * Mirrors the real geometry: identity header, a three-card reputation row, the
 * capabilities split, the identity record table and the rail. Resolving one
 * agent means paging the live index, so this is on screen for a moment on a
 * cold cache and must not promise a layout the page no longer renders.
 */
export default function AgentLoading() {
  return (
    <div className="container-x pb-24 pt-6 sm:pt-8" aria-busy="true" aria-label="Loading agent">
      <Block className="h-4 w-64" />

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          {/* header */}
          <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
            <Block className="h-20 w-20 shrink-0 rounded-2xl sm:h-24 sm:w-24" />
            <div className="min-w-0 flex-1 space-y-3">
              <Block className="h-9 w-2/3 max-w-sm" />
              <Block className="h-4 w-full max-w-md" />
              <Block className="h-4 w-full" />
              <Block className="h-4 w-11/12" />
              <Block className="h-3 w-3/4 max-w-lg" />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[72, 68, 64].map((width) => (
                  <Block key={width} className="h-7 rounded-full" style={{ width }} />
                ))}
              </div>
            </div>
          </div>

          {/* reputation */}
          <div className="space-y-4">
            <Block className="h-6 w-40" />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Block key={i} className="h-[248px] rounded-2xl" />
              ))}
            </div>
          </div>

          {/* capabilities */}
          <div className="space-y-4">
            <Block className="h-6 w-44" />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_20rem]">
              <Block className="h-[236px] rounded-2xl" />
              <Block className="h-[236px] rounded-2xl" />
            </div>
          </div>

          {/* identity record */}
          <div className="space-y-4">
            <Block className="h-6 w-52" />
            <Block className="h-[300px] w-full rounded-2xl md:h-[220px]" />
          </div>
        </div>

        {/* rail */}
        <div className="min-w-0 space-y-6">
          <Block className="h-[300px] w-full rounded-2xl" />
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
