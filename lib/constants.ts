export const APP_NAME = 'Bazar';
export const APP_TAGLINE = 'The Dual-Layer ERC-8004 AI Agent Marketplace for BNB Chain';

/** Development-only base URL. Publishing this as a discovery URL is a bug. */
const LOCAL_FALLBACK_URL = 'http://localhost:3000';

/**
 * Public base URL, stamped into /.well-known/agent.json, every docs example and
 * `metadataBase`. A machine caller resolves Bazar through it, so `localhost`
 * here is not a cosmetic default - it publishes an unreachable discovery URL.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_URL - always wins, and is the only option that works on
 *      a custom domain or a non-Vercel host (Docker, a plain Node server).
 *   2. The platform-reported host (VERCEL_URL / NEXT_PUBLIC_VERCEL_URL). This
 *      is a Vercel-only convenience and is unset everywhere else, so it is a
 *      safety net, not a substitute for (1).
 *   3. localhost, for `next dev`.
 *
 * Falling through to (3) in a production build is reported loudly below rather
 * than passed off as a working default.
 */
function resolveAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const platformHost = (process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL)?.trim();
  if (platformHost) return `https://${platformHost.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  return LOCAL_FALLBACK_URL;
}

export const APP_URL = resolveAppUrl();

/** True when nothing supplied a real host and the dev fallback is in use. */
export const APP_URL_IS_LOCAL_FALLBACK = APP_URL === LOCAL_FALLBACK_URL;

if (APP_URL_IS_LOCAL_FALLBACK && process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  console.warn(
    '[bazar] NEXT_PUBLIC_APP_URL is not set and no platform host was reported, so this build publishes ' +
      `${LOCAL_FALLBACK_URL} in /.well-known/agent.json and in every documented example. ` +
      'Set NEXT_PUBLIC_APP_URL to the public origin before deploying.',
  );
}

export const BSC_CHAIN_ID = 56;
export const BSC_TESTNET_CHAIN_ID = 97;

/**
 * Five is the ceiling here, not a preference. Between `md` and `lg` the navbar's
 * right-hand side drops the network chip and the Register button, but the link
 * row still has to share 768px with the logo and the connect button - a sixth
 * label overflows it. So the bar carries the destinations a visitor browses,
 * and account-level or evidence surfaces are reached from the footer and from
 * the flow that needs them.
 */
export const NAV_LINKS = [
  { href: '/marketplace', label: 'Marketplace' },
  // The PancakeSwap lane is a shelf, not a report: it answers "who serves my
  // LP position" out of the same live index the marketplace reads, so it sits
  // beside Marketplace rather than below it.
  { href: '/pancakeswap', label: 'PancakeSwap' },
  // Supply side sits at the same level as demand. Registration used to live
  // several screens down /developers, where an agent builder would never look.
  { href: '/register', label: 'List an agent' },
  { href: '/developers', label: 'A2A API' },
  { href: '/dashboard', label: 'Dashboard' },
] as const;

/**
 * Only destinations that actually resolve today, and only ones Bazar owns.
 *
 * Checked 2026-08-28:
 *   - https://github.com/mrnetwork0001/Bazar -> 404, the repository is not
 *     published yet.
 *   - https://x.com/BazarHQ -> does not resolve; the handle was never
 *     registered.
 *   - https://t.me/Bazar -> resolves, but it is NOT this project. The @Bazar
 *     handle belongs to an unrelated Persian-language news channel with 181
 *     subscribers, so linking it as "Bazar on Telegram" pointed every page at a
 *     stranger's channel. That is worse than a 404: a dead link is obviously
 *     broken, a live wrong one reads as verified provenance.
 *
 * All three are kept here, unrendered, so restoring a row is a one-line change
 * the day a destination exists. Nothing may link them until then.
 */
export const UNVERIFIED_LINKS = {
  github: 'https://github.com/mrnetwork0001/Bazar',
  x: 'https://x.com/BazarHQ',
  telegram: 'https://t.me/Bazar',
} as const;

export const SOCIAL_LINKS = {
  /** The public ERC-8004 index every listing on Bazar is read from. */
  indexer: 'https://8004scan.io',
  docs: '/developers',
} as const;
