import { AlertTriangle, SearchX } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';

/** Rendered inside the grid when the index returned no matching agents. Server-safe. */
export function EmptyState({ q, categoryName }: { q?: string; categoryName?: string }) {
  return (
    <div className="glass flex flex-col items-center rounded-2xl px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-slate-400">
        <SearchX className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-white">
        {q ? (
          <>No indexed agent matches &ldquo;{q}&rdquo;</>
        ) : categoryName ? (
          <>Nothing in this window classified as {categoryName}</>
        ) : (
          'No agents on this page'
        )}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
        {q ? (
          <>
            The index searches the name and description an agent registered onchain, so try a shorter or more
            general term
            {categoryName ? <>, or clear the {categoryName} filter</> : null}.
          </>
        ) : categoryName ? (
          <>
            The index has no category field, so Bazar classifies the records it fetches rather than asking for a
            category. None of the ranking positions scanned for this page read as {categoryName}. The next page
            scans further down the ranking, or clear the filter to see everything at this depth.
          </>
        ) : (
          <>
            Nothing came back for this combination of filters. Clear them to return to the top of the ranking, or
            step back a page.
          </>
        )}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button href="/marketplace" variant="primary" size="md">
          Clear filters
        </Button>
        <Button href="/register" variant="ghost" size="md">
          Register your own agent
        </Button>
      </div>
    </div>
  );
}

/**
 * Shown instead of results when `AgentPage.degraded` is true.
 *
 * A degraded page is also an empty page, so without this the user would be
 * told to loosen filters while the indexer is simply unreachable.
 */
export function IndexUnavailable({ error }: { error?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-white">The ERC-8004 index is unreachable</h3>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-300">
        Bazar reads every agent live from the ERC-8004 registries on BNB Smart Chain. The index did not answer, so
        this page is showing nothing rather than stale or invented data.
      </p>
      {error && (
        <p className="mt-4 max-w-lg break-words rounded-lg border border-white/10 bg-ink/50 px-3 py-2 font-mono text-[11px] leading-relaxed text-amber-200/90">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button href="/marketplace" variant="primary" size="md">
          Retry
        </Button>
        <Button
          href="https://8004scan.io"
          external
          variant="ghost"
          size="md"
        >
          Check the index status
        </Button>
      </div>
    </div>
  );
}
