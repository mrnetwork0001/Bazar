'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

/** `null` / `undefined` / `''` removes the key; any other string sets it. */
export type ParamUpdates = Partial<Record<string, string | null | undefined>>;

export function buildSearch(current: { toString(): string }, updates: ParamUpdates): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '') next.delete(key);
    else next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `?${qs}` : '';
}

/**
 * URL-driven marketplace state. Every control updates one key while
 * preserving the others; `clearAll` resets to the page defaults.
 *
 * Every update re-renders the server page, which re-queries the live index:
 * measured at roughly a second end to end. `router.replace` inside a transition
 * exposes that as `pending` so the controls can show they are working. Without
 * it the grid sat on the previous results for a second with no feedback and the
 * search read as broken - `app/marketplace/loading.tsx` does not cover this,
 * because a searchParams-only replace never remounts the loading boundary.
 *
 * Must be rendered inside a `<Suspense>` boundary (uses `useSearchParams`).
 */
export function useMarketplaceParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const href = useCallback(
    (updates: ParamUpdates) => `${pathname}${buildSearch(searchParams, updates)}`,
    [pathname, searchParams],
  );

  const set = useCallback(
    (updates: ParamUpdates) => {
      startTransition(() => {
        router.replace(href(updates), { scroll: false });
      });
    },
    [router, href],
  );

  const clearAll = useCallback(() => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }, [router, pathname]);

  return { searchParams, pathname, href, set, clearAll, pending };
}
