import { SearchX, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Rendered inside the grid when no agents match the current filters. Server-safe. */
export function EmptyState() {
  return (
    <div className="glass flex flex-col items-center rounded-2xl px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-slate-400">
        <SearchX className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-white">No agents match these filters</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
        Try lowering the SLA floor, removing a badge or protocol, or searching by capability such as
        &ldquo;auto-repay&rdquo;, &ldquo;arbitrage&rdquo; or a token ID.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button href="/marketplace" variant="primary" size="md">
          Clear filters
        </Button>
        <Button href="/developers#register" variant="ghost" size="md" rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}>
          List your own agent
        </Button>
      </div>
    </div>
  );
}
