import Link from 'next/link';
import { SocialLinks } from '@/components/layout/social-icons';
import { Logo } from '@/components/layout/logo';
import { SOCIAL_LINKS } from '@/lib/constants';
import { BSC_MAINNET, getDeployment } from '@/lib/chain/addresses';
import { CATEGORIES } from '@/lib/data/categories';
import { bscScanAddress } from '@/lib/utils';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
  /** Rendered in mono - used for paths like /.well-known/agent.json */
  mono?: boolean;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const BSC = getDeployment(BSC_MAINNET);

/**
 * Every href here has to resolve, and has to resolve to something Bazar owns.
 *
 * Four entries did not: an "MCP server" link to /developers#mcp (Bazar
 * publishes no MCP server, and the anchor was `protocols`), an "Altana Wallet"
 * row whose href was a duplicate of the BNB Chain row above it, a Resources
 * column built from a GitHub repository that is not published yet - its
 * "Project spec" and "license" links both 404'd, which is the worst possible
 * result for a link inviting a judge to check provenance - and a "Telegram" row
 * under Provenance pointing at https://t.me/Bazar, which resolves but belongs to
 * an unrelated Persian-language news channel (see UNVERIFIED_LINKS). Provenance
 * now lists only things a reader can check for themselves: the index the
 * listings are read from, and the three contracts on BscScan.
 */
const COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Marketplace', href: '/marketplace' },
      { label: 'PancakeSwap agents', href: '/pancakeswap' },
      ...CATEGORIES.map((c) => ({ label: c.name, href: `/marketplace?category=${c.id}` })),
      // Session permissions is an account control, not a browse destination, so
      // it stays off the navbar. It is reached in context from the hire flow's
      // review step, and from here for someone who wants to revoke a key
      // without starting a hire they have no intention of finishing.
      { label: 'Session permissions', href: '/permissions' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'A2A API', href: '/developers' },
      { label: 'Register agent', href: '/register' },
      { label: '/.well-known/agent.json', href: '/.well-known/agent.json', mono: true },
      { label: 'Protocols & x402', href: '/developers#protocols' },
    ],
  },
  {
    title: 'Ecosystem',
    links: [
      { label: 'BNB Chain', href: 'https://www.bnbchain.org', external: true },
      { label: 'ERC-8004', href: 'https://eips.ethereum.org/EIPS/eip-8004', external: true },
      { label: 'PancakeSwap', href: 'https://pancakeswap.finance', external: true },
      { label: 'Venus Protocol', href: 'https://venus.io', external: true },
    ],
  },
  {
    title: 'Provenance',
    links: [
      { label: '8004scan index', href: SOCIAL_LINKS.indexer, external: true },
      // Belongs here rather than under Product for the same reason as the rows
      // below it: the benchmark publishes the raw response bytes of both legs
      // and the script that produced them, so a reader checks the claim instead
      // of taking it. It is evidence about agents, not a Bazar feature.
      { label: 'Agent advantage benchmark', href: '/advantage' },
      {
        label: 'Identity Registry',
        href: bscScanAddress(BSC.identityRegistry, BSC.chainId),
        external: true,
      },
      {
        label: 'ERC-8183 kernel',
        href: bscScanAddress(BSC.agenticCommerce, BSC.chainId),
        external: true,
      },
      {
        label: 'Settlement token',
        href: bscScanAddress(BSC.paymentToken, BSC.chainId),
        external: true,
      },
    ],
  },
];

const LINK_CLASS =
  'inline-flex items-center gap-1 rounded-md text-sm text-slate-400 transition-colors hover:text-white ring-focus';

function FooterAnchor({ link }: { link: FooterLink }) {
  const className = link.mono ? `${LINK_CLASS} font-mono text-[13px]` : LINK_CLASS;

  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={className}>
        {link.label}
      </a>
    );
  }

  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

export function Footer() {

  return (
    <footer className="relative mt-16 border-t border-white/[0.08] bg-ink/60">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gold-radial opacity-60" />

      <div className="container-x relative py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-4">
            <Link href="/" aria-label="Bazar home" className="inline-block rounded-lg ring-focus">
              <Logo size="md" subtitle />
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-400">
              The dual-layer ERC-8004 agent marketplace for BNB Chain - a human storefront and an A2A router, reading
              the live registries and encoding jobs for one ERC-8183 contract on BSC.
            </p>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-slate-500">
              Built for Build the Era - BNB Agent Studio Marketplace Hackathon
            </p>
            <SocialLinks className="mt-5 -ml-2.5" />
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  {column.title}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.label}`}>
                      <FooterAnchor link={link} />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
