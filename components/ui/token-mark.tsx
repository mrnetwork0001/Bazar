import { cn } from '@/lib/utils';

/**
 * The settlement token's own mark.
 *
 * The artwork is the logo Trust Wallet publishes for this exact contract
 * (`blockchains/smartchain/assets/0xcE24439F2D9C6a2289F741120FE202248B666666`),
 * vendored at 64px rather than hotlinked so a card does not depend on
 * raw.githubusercontent.com being reachable.
 *
 * It is deliberately keyed to the address, not to the symbol. "U" is one
 * character and several unrelated tokens use it; painting this coin next to a
 * balance in some other token would be a claim about which asset the reader
 * holds, made in a picture. `KNOWN_MARKS` is the whole set of addresses this
 * component will draw for, and anything else falls back to the ticker text.
 */
const KNOWN_MARKS: Record<string, string> = {
  // United Stables (U) - the ERC-8183 kernel's settlement token on BSC.
  '0xce24439f2d9c6a2289f741120fe202248b666666': '/u-token.png',
};

export interface TokenMarkProps {
  /** The token's contract address. Case-insensitive. */
  address: string;
  /** Ticker, rendered beside the mark and used alone when there is no mark. */
  symbol: string;
  /** Rendered size of the coin, in px. */
  size?: number;
  className?: string;
}

export function TokenMark({ address, symbol, size = 16, className }: TokenMarkProps) {
  const src = KNOWN_MARKS[address.toLowerCase()];

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- fixed local asset, already sized
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className="shrink-0 rounded-full"
          draggable={false}
        />
      )}
      <span>{symbol}</span>
    </span>
  );
}
