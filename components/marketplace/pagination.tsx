import Link from 'next/link';
import { ChevronLeft, ChevronRight } from '@/components/ui/icons';
import { cn, formatNumber } from '@/lib/utils';
import { MAX_OFFSET, marketplaceHref, type MarketplaceParams, type QuotedTotal } from './marketplace-config';

export interface PaginationProps {
  params: MarketplaceParams;
  /**
   * The page's one resolved total (`resolveTotal`), shared with ResultsHeader.
   * It bounds the walk: `basis: 'index'` is every agent on the chain,
   * `'matching'` is every row matching this query's index-side filters. Either
   * way it counts ranking positions, which is exactly what `offset` steps
   * through - a category selection filters locally and does not shrink it.
   */
  total: QuotedTotal;
  /** Ranking positions consumed per page. */
  step: number;
  /** Agents rendered on the current page. */
  count: number;
  className?: string;
}

const CONTROL =
  'inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition-colors duration-200 ring-focus';

/**
 * Offset-based prev / next, preserving every other param.
 *
 * The total is the number of pages Bazar will actually walk, not the number
 * the index could theoretically fill. Paging stops at MAX_OFFSET, so the bound
 * is min(total, cap) - quoting "of 11,999" would be true of the index and
 * false of this control, and would invite a walk into the bulk-registered tail
 * that Bazar deliberately will not serve.
 *
 * With a category selected the pages still step ranking positions: the filter
 * runs locally and does not shrink the walk, so this counts pages of the
 * ranking rather than pages of that category. A per-category page count does
 * not exist - the index cannot report one - and is not implied here.
 */
export function Pagination({ params, total, step, count, className }: PaginationProps) {
  const { offset } = params;
  const pageNumber = Math.floor(offset / step) + 1;
  const hasPrev = offset > 0;
  // Bounded by ranking positions, not by how many cards survived. Under a
  // category filter the classifier can reject every row in a scanned window,
  // and gating Next on `count > 0` stranded the reader on an empty page with
  // the only way forward removed. When the total is unknown (both counts
  // degraded) fall back to "this page returned a full window".
  const remaining = total.known ? offset + step < total.value : count >= step;
  const capped = offset + step > MAX_OFFSET;

  /**
   * Pages Bazar will serve, which is not pages the index could fill: the walk
   * stops at MAX_OFFSET. Null when no total answered, in which case the
   * control shows the page number alone rather than inventing a denominator.
   */
  const totalPages = total.known ? Math.max(1, Math.ceil(Math.min(total.value, MAX_OFFSET + step) / step)) : null;
  const hasNext = remaining && !capped;
  const deep = pageNumber >= 6;

  if (!hasPrev && !hasNext) return null;

  return (
    <nav aria-label="Pagination" className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-3">
        {hasPrev ? (
          <Link
            href={marketplaceHref(params, { offset: Math.max(offset - step, 0) })}
            rel="prev"
            className={cn(CONTROL, 'border-white/[0.08] bg-white/[0.04] text-slate-200 hover:border-white/20 hover:text-white')}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Previous
          </Link>
        ) : (
          // Perceivable and announced as disabled rather than hidden: a screen
          // reader user needs to know they are at the first page, not to find
          // the control missing.
          <span
            role="link"
            aria-disabled="true"
            className={cn(CONTROL, 'cursor-not-allowed border-white/[0.05] bg-white/[0.02] text-slate-500')}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Previous
          </span>
        )}

        <span className="tabular text-xs text-slate-500">
          Page {formatNumber(pageNumber, { compact: false })}
          {totalPages !== null && (
            <>
              {' '}
              <span className="text-slate-500">of {formatNumber(totalPages, { compact: false })}</span>
            </>
          )}
        </span>

        {hasNext ? (
          <Link
            href={marketplaceHref(params, { offset: offset + step })}
            rel="next"
            className={cn(CONTROL, 'border-bnb/30 bg-bnb/10 text-bnb hover:border-bnb/50 hover:bg-bnb/15')}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <span
            role="link"
            aria-disabled="true"
            className={cn(CONTROL, 'cursor-not-allowed border-white/[0.05] bg-white/[0.02] text-slate-500')}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>

      {capped ? (
        <p className="text-center text-xs leading-relaxed text-slate-400">
          Paging stops at ranking position {formatNumber(MAX_OFFSET, { compact: false })}. That is a stated choice, not
          the end of the index: below it the ranking is almost entirely bulk registrations that have never received a
          feedback entry, and Bazar curates the head of the index rather than dumping the tail.
        </p>
      ) : (
        deep && (
          <p className="text-center text-xs leading-relaxed text-slate-400">
            You are past the top of the ranking. Almost nothing this far down the index has ever received a feedback
            entry, and a large share carry a zero reputation score.
          </p>
        )
      )}
    </nav>
  );
}
