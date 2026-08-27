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
 * Bazar mark: a BNB-gold hexagon (the chain) wrapping an isometric cube (the block / agent).
 * Pure inline SVG — server-safe, no ids, no external assets.
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
      {/* Outer hexagon */}
      <path
        d="M16 2 L28.12 9 L28.12 23 L16 30 L3.88 23 L3.88 9 Z"
        fill="rgba(240,185,11,0.09)"
        stroke="#F0B90B"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Isometric cube: top / left / right faces */}
      <path d="M16 8 L22.93 12 L16 16 L9.07 12 Z" fill="#FCD34D" />
      <path d="M9.07 12 L16 16 L16 24 L9.07 20 Z" fill="#F0B90B" />
      <path d="M16 16 L22.93 12 L22.93 20 L16 24 Z" fill="#A67C07" />
      {/* Crisp edges */}
      <path
        d="M16 8 L22.93 12 L22.93 20 L16 24 L9.07 20 L9.07 12 Z M16 16 L9.07 12 M16 16 L22.93 12 M16 16 L16 24"
        stroke="#07080B"
        strokeWidth="0.6"
        strokeLinejoin="round"
        opacity="0.7"
      />
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
