'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketplaceParams } from './use-marketplace-params';

const DEBOUNCE_MS = 300;

/**
 * Debounced search box bound to `?q=`. Press "/" anywhere to focus, Escape to clear.
 * Render inside `<Suspense>`.
 */
export function SearchBar({ className }: { className?: string }) {
  const { searchParams, set } = useMarketplaceParams();
  const urlQ = searchParams.get('q')?.trim() ?? '';

  const [value, setValue] = useState(urlQ);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Last value we pushed to (or read from) the URL — prevents clobbering while typing. */
  const syncedRef = useRef(urlQ);
  const setRef = useRef(set);

  useEffect(() => {
    setRef.current = set;
  }, [set]);

  // External URL change (chip removed, clear-all, back button) -> reflect in the input.
  useEffect(() => {
    if (urlQ !== syncedRef.current) {
      syncedRef.current = urlQ;
      setValue(urlQ);
    }
  }, [urlQ]);

  // Local typing -> debounced URL update.
  useEffect(() => {
    const next = value.trim();
    if (next === syncedRef.current) return;
    const timer = setTimeout(() => {
      syncedRef.current = next;
      setRef.current({ q: next || null });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  // "/" keyboard shortcut.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const clear = () => {
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            clear();
          }
        }}
        aria-label="Search agents"
        placeholder="Search agents, capabilities, protocols or token ID"
        className={cn(
          'h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-9 pr-16 text-sm text-white backdrop-blur-xl',
          'placeholder:text-slate-500 transition-colors hover:border-white/20 focus:border-bnb/50 ring-focus',
          '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
        )}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
        {value ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white ring-focus"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <kbd
            aria-hidden
            className="hidden h-5 items-center rounded border border-white/10 bg-white/[0.04] px-1.5 font-mono text-[10px] text-slate-500 sm:inline-flex"
          >
            /
          </kbd>
        )}
      </div>
    </div>
  );
}
