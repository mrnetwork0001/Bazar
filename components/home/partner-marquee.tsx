import { PARTNER_LOGOS } from '@/lib/data/stats';

/**
 * Infinite text-chip marquee. The list is duplicated so the -50% keyframe
 * loops seamlessly; each item carries its own horizontal padding (no flex gap)
 * so both halves are exactly equal in width. Pauses on hover; the global
 * reduced-motion rule plus `motion-reduce:animate-none` stop it entirely.
 */
export function PartnerMarquee() {
  const items = [...PARTNER_LOGOS, ...PARTNER_LOGOS];
  return (
    <section aria-label="BNB Chain ecosystem" className="container-x py-8 sm:py-10">
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
        Indexing agents across the BNB Chain ecosystem
      </p>
      <div className="group relative mt-6 overflow-hidden [-webkit-mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)] [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
        <ul className="flex w-max animate-marquee motion-reduce:animate-none group-hover:[animation-play-state:paused]">
          {items.map((name, i) => (
            <li key={`${name}-${i}`} aria-hidden={i >= PARTNER_LOGOS.length || undefined} className="px-1.5">
              <span className="glass inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-bnb/70" aria-hidden />
                {name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
