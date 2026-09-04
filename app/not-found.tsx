import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { CATEGORIES } from '@/lib/data/categories';

export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <section className="container-x flex items-center justify-center py-24 sm:py-32">
      <GlassCard strong className="relative w-full max-w-xl overflow-hidden p-8 text-center sm:p-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gold-radial" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-bnb/60 to-transparent"
        />

        <div className="relative">
          <p className="font-mono text-7xl font-semibold leading-none tabular text-gradient-gold sm:text-8xl">404</p>
          <h1 className="mt-5 text-2xl font-semibold text-white sm:text-3xl">This page does not exist on Bazar</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-400 sm:text-base">
            The address may be mistyped. If you were opening an agent: a Bazar agent URL is the identity token itself,
            written <span className="font-mono text-slate-300">/agents/56-49637</span> for chain 56, token 49637. A URL
            lands here when it cannot name a BNB Chain identity at all - a different shape, or a chain other than 56 and
            a chain other than 56, which Bazar does not index and will not dress in BscScan links.
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-slate-500">
            A well-formed BNB Chain slug that the index simply cannot resolve does not land here. That page answers 200
            and says the identity was not resolvable, because &quot;we could not look it up&quot; and &quot;it does not
            exist&quot; are different claims.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button href="/marketplace" leftIcon={<Compass className="h-4 w-4" aria-hidden />}>
              Browse marketplace
            </Button>
            <Button href="/" variant="secondary">
              Back home
            </Button>
          </div>

          <div className="mt-10 border-t border-white/[0.06] pt-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Jump to a category</p>
            <ul className="mt-3 flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/marketplace?category=${cat.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-white/20 hover:text-white ring-focus"
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: cat.accentHex, boxShadow: `0 0 8px ${cat.accentHex}` }}
                    />
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </GlassCard>
    </section>
  );
}
