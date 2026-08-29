/**
 * The standards and infrastructure Bazar actually touches.
 *
 * This replaced a logo wall of protocol names Bazar has no relationship with.
 * Every entry below is something the codebase genuinely uses: a registry it
 * reads, the chain and index it reads them from, the kernel it ABI-encodes
 * calls for (encodes and settles through today), the protocol flags it
 * reports off each registration, or the explorer it links out to. Bazar does
 * not itself speak MCP - it publishes what an agent declares.
 */
const STACK = [
  'ERC-8004 Identity Registry',
  'ERC-8004 Reputation Registry',
  'BNB Smart Chain',
  'ERC-8183 AgenticCommerce',
  '8004scan index',
  'A2A',
  'MCP',
  'x402',
  'BscScan',
] as const;

/**
 * Infinite text-chip marquee. The list is duplicated so the -50% keyframe
 * loops seamlessly; each item carries its own horizontal padding (no flex gap)
 * so both halves are exactly equal in width. Pauses on hover; the global
 * reduced-motion rule plus `motion-reduce:animate-none` stop it entirely.
 */
export function PartnerMarquee() {
  const items = [...STACK, ...STACK];
  return (
    <section aria-label="Standards and infrastructure Bazar reads from" className="container-x py-8 sm:py-10">
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
        What Bazar reads, and what it encodes against
      </p>
      <div className="group relative mt-6 overflow-hidden [-webkit-mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)] [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
        <ul className="flex w-max animate-marquee motion-reduce:animate-none group-hover:[animation-play-state:paused]">
          {items.map((name, i) => (
            <li key={`${name}-${i}`} aria-hidden={i >= STACK.length || undefined} className="px-1.5">
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
