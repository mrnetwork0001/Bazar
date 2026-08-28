'use client';

import { useEffect } from 'react';
import { Compass, RotateCcw, TriangleAlert } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[bazar] route error', error);
  }, [error]);

  return (
    <section className="container-x flex items-center justify-center py-24 sm:py-32">
      <GlassCard
        strong
        role="alert"
        aria-labelledby="route-error-title"
        className="relative w-full max-w-lg overflow-hidden p-8 text-center sm:p-10"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/60 to-transparent"
        />
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
          <TriangleAlert className="h-6 w-6" aria-hidden />
        </span>
        <h1 id="route-error-title" className="mt-5 text-2xl font-semibold text-white">
          Something broke on our side
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          This page hit an unexpected error while rendering. Every Bazar surface only reads the ERC-8004 index; nothing
          in the app signs or broadcasts a transaction today, so an error here cannot have left one half-sent.
        </p>

        {error.message ? (
          <>
            <h2 className="sr-only">Error detail</h2>
            <pre className="mt-4 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/[0.06] bg-ink/70 p-3 text-left font-mono text-xs text-rose-200/90">
              {error.message}
            </pre>
          </>
        ) : null}
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-slate-500">
            Digest <span className="text-slate-400">{error.digest}</span>
          </p>
        ) : null}

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={reset} leftIcon={<RotateCcw className="h-4 w-4" aria-hidden />}>
            Try again
          </Button>
          <Button href="/marketplace" variant="secondary" leftIcon={<Compass className="h-4 w-4" aria-hidden />}>
            Go to marketplace
          </Button>
        </div>
      </GlassCard>
    </section>
  );
}
