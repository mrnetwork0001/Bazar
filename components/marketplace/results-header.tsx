import { ArrowUpDown } from '@/components/ui/icons';
import { formatNumber } from '@/lib/utils';
import { sortLabel, type QuotedTotal, type SortKey } from './marketplace-config';

export interface ResultsHeaderProps {
  /** Agents rendered on this page. */
  count: number;
  /**
   * The one total this page quotes, resolved once by `resolveTotal` and shared
   * with Pagination and the page header, so no two lines on the screen can
   * print different numbers for the same thing. `basis` says what it counts.
   */
  total: QuotedTotal;
  offset: number;
  /** Ranking positions consumed per page (larger when a category is filtered locally). */
  step: number;
  categoryName?: string;
  /** How many agents on this page matched a category term in their own registration. */
  classified?: number;
  q?: string;
  sort: SortKey;
  degraded?: boolean;
}

/**
 * "N agents · ranked X-Y of M indexed" line with sort and index status.
 *
 * The wording is deliberate. The index holds hundreds of thousands of BSC
 * agents and Bazar shows a ranked window into it, so the copy never claims the
 * whole set is being browsed.
 *
 * A category page may now quote a total next to the category name, because one
 * finally exists: the shelf is fetched by searching the index for the
 * category's own terms, so `basis: 'category'` counts agents whose registration
 * text files them there. That is a real count of the category and is printed as
 * one.
 *
 * The older wording is still reachable and still required. Combining a category
 * with a free-text search falls back to classifying one fetched window, and in
 * that mode no per-category count exists; the line then reports the ranking
 * positions scanned and states the index-wide number separately, as what it is,
 * rather than implying it counts the category. Server-safe.
 */
export function ResultsHeader({
  count,
  total,
  offset,
  step,
  categoryName,
  classified,
  q,
  sort,
  degraded,
}: ResultsHeaderProps) {
  // 'category' totals count the shelf itself, so the page is showing a real set
  // rather than a scanned window into the ranking. Only the fallback mode -
  // category plus a search - is still a scan.
  const scanned = Boolean(categoryName) && total.basis !== 'category';
  const start = offset + 1;
  const rawEnd = offset + (scanned ? step : count);
  // Never advertise a window wider than the set it is a window into: a narrow
  // search inside a category would otherwise read "positions 1-96 of 47".
  const end = total.known && total.value > 0 ? Math.min(rawEnd, Math.max(total.value, start)) : rawEnd;
  const showRange = count > 0;
  const showTotalInline = showRange && !scanned && total.known && total.value > 0;
  // The unclassified note only earns its space when the page actually contains
  // an unclassified agent. A category shelf built from search does not, so the
  // paragraph would explain a coverage placement the reader cannot see.
  const showClassified =
    !degraded && count > 0 && classified !== undefined && classified < count;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
      <p className="text-slate-400" aria-live="polite">
        {degraded ? (
          <span className="text-slate-300">No results - the index did not answer</span>
        ) : (
          <>
            <span className="tabular font-semibold text-white">{formatNumber(count, { compact: false })}</span>
            <span> {count === 1 ? 'agent' : 'agents'}</span>
            {categoryName && (
              <>
                <span> in </span>
                <span className="font-medium text-slate-200">{categoryName}</span>
              </>
            )}
            {q && (
              <>
                <span> matching </span>
                <span className="font-medium text-slate-200">&ldquo;{q}&rdquo;</span>
              </>
            )}
            {showRange && (
              <span className="text-slate-500">
                {scanned ? ' · classified from ranking positions ' : ' · ranked '}
                <span className="tabular">
                  {formatNumber(start, { compact: false })}-{formatNumber(end, { compact: false })}
                </span>
                {showTotalInline && (
                  <>
                    {' of '}
                    <span className="tabular">{formatNumber(total.value, { compact: false })}</span>{' '}
                    {total.basis === 'matching'
                      ? 'matching'
                      : total.basis === 'category'
                        ? 'in this category'
                        : 'indexed'}
                  </>
                )}
              </span>
            )}
          </>
        )}
      </p>
      {showClassified && (
        <p className="order-last w-full text-xs leading-relaxed text-slate-400">
          {formatNumber(classified as number, { compact: false })} of{' '}
          {formatNumber(count, { compact: false })} on this page matched a category term in their own registration
          text. The rest publish no category signal and are marked{' '}
          <span className="font-medium text-slate-300">Unclassified</span> - ERC-8004 has no category field, so Bazar
          spreads those across the four buckets for coverage rather than claiming they belong to one.
          {scanned && total.known && total.value > 0 && (
            <>
              {' '}
              Because that classification happens here rather than on the index, there is no per-category total to
              quote: the{' '}
              <span className="tabular font-medium text-slate-300">
                {formatNumber(total.value, { compact: false })}
              </span>{' '}
              {total.basis === 'matching' ? 'matching agents' : 'agents indexed on BSC'} are the set these positions
              are read from, not a count of {categoryName}.
            </>
          )}
        </p>
      )}
      <p className="flex items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
          Sorted by {sortLabel(sort)}
        </span>
        {degraded ? (
          <span className="inline-flex items-center gap-1.5 text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            Index unreachable
          </span>
        ) : (
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live from the ERC-8004 index
          </span>
        )}
      </p>
    </div>
  );
}
