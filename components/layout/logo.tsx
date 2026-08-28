import { cn } from '@/lib/utils';

export type LogoSize = 'sm' | 'md' | 'lg';

const MARK_PX: Record<LogoSize, number> = { sm: 26, md: 32, lg: 40 };
const WORD_CLASS: Record<LogoSize, string> = {
  sm: 'text-[17px]',
  md: 'text-xl',
  lg: 'text-2xl',
};

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

export function Logo({ size = 'md', withWordmark = true, subtitle = false, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      {withWordmark ? (
        <span className="flex flex-col leading-none">
          <span className={cn('font-semibold tracking-tight text-gradient-white', WORD_CLASS[size])}>Bazar</span>
          {subtitle && (
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-bnb/80">BNB Chain</span>
          )}
        </span>
      ) : (
        <span className="sr-only">Bazar</span>
      )}
    </span>
  );
}
