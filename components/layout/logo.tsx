import { cn } from '@/lib/utils';

export type LogoSize = 'sm' | 'md' | 'lg';

const MARK_PX: Record<LogoSize, number> = { sm: 26, md: 32, lg: 40 };

/**
 * Rendered height of the horizontal lockup, in px.
 *
 * These look small next to the previous 52/68/84, and render identically. The
 * artwork used to carry ~47% dead margin, so more than half of any height set
 * here was spent on empty pixels; it has since been trimmed to its content box.
 * The values were scaled by the same ratio (402/747) so the glyphs keep the
 * size they already had - change them to resize the lockup, not to compensate
 * for padding that is no longer in the file.
 */
const LOCKUP_PX: Record<LogoSize, number> = { sm: 28, md: 37, lg: 45 };
export interface LogoMarkProps {
  /** Named size or an explicit pixel size */
  size?: LogoSize | number;
  className?: string;
}

/**
 * Bazar mark: a bazaar archway - the gateway into a market - enclosing a
 * three-node agent graph: one hub hiring two sub-agents, which is literally
 * what the A2A router does.
 *
 * Chosen over the previous hexagon-and-cube because that mark said "generic
 * web3" and nothing about a marketplace. Pure inline SVG, server-safe, no ids,
 * no external assets.
 */
export function LogoMark({ size = 'md', className }: LogoMarkProps) {
  const px = typeof size === 'number' ? size : MARK_PX[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
      className={cn('shrink-0', className)}
    >
      {/* Archway */}
      <path
        d="M7 27 L7 13.5 A13 13 0 0 1 16 4.5 A13 13 0 0 1 25 13.5 L25 27"
        fill="rgba(240,185,11,0.10)"
        stroke="#F0B90B"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Hub -> two hired agents */}
      <path
        d="M16 14.5 L10.75 21.5 M16 14.5 L21.25 21.5"
        stroke="#F0B90B"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx="16" cy="14.5" r="2.5" fill="#FCD34D" />
      <circle cx="10.75" cy="21.5" r="1.7" fill="#F0B90B" />
      <circle cx="21.25" cy="21.5" r="1.7" fill="#F0B90B" />
    </svg>
  );
}

export interface LogoProps {
  size?: LogoSize;
  /** Render the "Bazar" wordmark next to the mark (default true) */
  withWordmark?: boolean;
  /** Render the tiny "BNB Chain" subtitle under the wordmark */
  subtitle?: boolean;
  className?: string;
}

/**
 * The supplied horizontal lockup, used in the header and the footer.
 *
 * It replaced an inline SVG mark plus a text wordmark. The artwork is a single
 * image already containing both, so drawing a second wordmark beside it would
 * repeat the name.
 *
 * The supplied file was opaque RGB: white and BNB gold baked onto a solid black
 * rectangle. That disappeared against the app's #07080B ground and showed as a
 * black slab anywhere else - over a scrolled glass header, over any lifted
 * surface. It is now RGBA with a real alpha channel, recovered by treating the
 * artwork as premultiplied against its black matte (alpha = max(r,g,b), colour
 * divided back out) rather than by keying a threshold, which is why the
 * antialiased edges carry no dark fringe. It may be placed on any background.
 */
export function Logo({ size = 'md', withWordmark = true, subtitle = false, className }: LogoProps) {
  const height = LOCKUP_PX[size];
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed local asset, no optimisation needed */}
      <img
        src="/bazar-header.png"
        alt="Bazar"
        height={height}
        style={{ height, width: 'auto' }}
        className="block select-none"
        draggable={false}
      />
      {subtitle && (
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-bnb/80">BNB Chain</span>
      )}
      {!withWordmark && <span className="sr-only">Bazar</span>}
    </span>
  );
}
