'use client';

/**
 * Onchain feedback for one agent, five at a time.
 *
 * Paginated client-side rather than server-side: the whole set arrives in one
 * `readAllFeedback` call, so paging it is slicing an array Bazar already holds,
 * not another round trip. Most agents have none at all, and the ones that do
 * rarely have more than a handful.
 *
 * There is no comment text anywhere here because ERC-8004 feedback has none -
 * it is a signed value and up to two tags. Rendering a review body would mean
 * inventing one.
 */

import { useState } from 'react';
import type { FeedbackRecord } from '@/lib/chain/reputation';
import { Badge } from '@/components/ui/badge';
import { bscScanAddress, cn, shortAddress } from '@/lib/utils';

const PER_PAGE = 5;

export interface FeedbackListProps {
  records: FeedbackRecord[];
  chainId: number;
  /** Set when the registry could not be read - distinct from having none. */
  unavailable?: string | null;
}

export function FeedbackList({ records, chainId, unavailable }: FeedbackListProps) {
  const [page, setPage] = useState(0);

  if (unavailable) {
    return (
      <p className="text-sm leading-relaxed text-slate-500">
        The Reputation Registry did not answer, so no feedback is shown. Bazar leaves it out rather than implying this
        agent has none.
      </p>
    );
  }

  if (records.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-slate-500">
        No feedback recorded onchain. That is the common case on BNB Chain - it means nobody has left a rating in the
        ERC-8004 Reputation Registry, not that this agent was rated badly.
      </p>
    );
  }

  const pages = Math.ceil(records.length / PER_PAGE);
  const shown = records.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
    <div>
      <ul className="space-y-2">
        {shown.map((r) => (
          <li
            key={`${r.client}-${r.index}`}
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5',
              r.revoked && 'opacity-60',
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <a
                href={bscScanAddress(r.client, chainId)}
                target="_blank"
                rel="noreferrer"
                className="ring-focus truncate font-mono text-xs text-slate-300 hover:text-bnb"
              >
                {shortAddress(r.client, 4)}
              </a>
              {r.tag1 && <Badge tone="slate">{r.tag1}</Badge>}
              {r.tag2 && <Badge tone="slate">{r.tag2}</Badge>}
              {r.revoked && <Badge tone="rose">Revoked</Badge>}
            </div>
            <span className="tabular shrink-0 text-sm font-medium text-white">{r.value}</span>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            Page <span className="tabular text-slate-300">{page + 1}</span> of{' '}
            <span className="tabular text-slate-300">{pages}</span>
            <span className="text-slate-600"> · {records.length} records onchain</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="ring-focus rounded-lg border border-white/[0.10] px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-white/25 hover:text-white disabled:pointer-events-none disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              className="ring-focus rounded-lg border border-white/[0.10] px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-white/25 hover:text-white disabled:pointer-events-none disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
