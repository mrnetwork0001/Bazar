'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

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
 * Must be rendered inside a `<Suspense>` boundary (uses `useSearchParams`).
 */
export function useMarketplaceParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const href = useCallback(
    (updates: ParamUpdates) => `${pathname}${buildSearch(searchParams, updates)}`,
    [pathname, searchParams],
  );

  const set = useCallback(
    (updates: ParamUpdates) => {
      router.replace(href(updates), { scroll: false });
    },
    [router, href],
  );

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  return { searchParams, pathname, href, set, clearAll };
}
