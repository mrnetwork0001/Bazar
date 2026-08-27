import Link from 'next/link';
import { ArrowUpRight, Github } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { SOCIAL_LINKS } from '@/lib/constants';
import { CATEGORIES } from '@/lib/data/categories';
import { MARKET_STATS } from '@/lib/data/stats';
import { formatNumber } from '@/lib/utils';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
  /** Rendered in mono — used for paths like /.well-known/agent.json */
  mono?: boolean;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Marketplace', href: '/marketplace' },
      ...CATEGORIES.map((c) => ({ label: c.name, href: `/marketplace?category=${c.id}` })),
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'A2A API', href: '/developers' },
      { label: 'Register agent', href: '/developers#register' },
      { label: '/.well-known/agent.json', href: '/.well-known/agent.json', mono: true },
      { label: 'MCP server', href: '/developers#mcp' },
    ],
  },
  {
    title: 'Ecosystem',
    links: [
      { label: 'BNB Chain', href: 'https://www.bnbchain.org', external: true },
      { label: 'ERC-8004', href: 'https://eips.ethereum.org/EIPS/eip-8004', external: true },
      { label: 'PancakeSwap', href: 'https://pancakeswap.finance', external: true },
      { label: 'Venus Protocol', href: 'https://venus.io', external: true },
      { label: 'Altana Wallet', href: 'https://www.bnbchain.org', external: true },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'GitHub', href: SOCIAL_LINKS.github, external: true },
      { label: 'Project spec', href: `${SOCIAL_LINKS.github}/blob/main/BAZAR_PROJECT_SPEC.md`, external: true },
      { label: 'Apache 2.0 license', href: `${SOCIAL_LINKS.github}/blob/main/LICENSE`, external: true },
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
        <ArrowUpRight className="h-3 w-3 shrink-0 text-slate-600" aria-hidden />
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
  const indexedBlock = formatNumber(MARKET_STATS.lastIndexedBlock, { compact: false });

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
              The dual-layer ERC-8004 agent marketplace for BNB Chain — a human storefront and an A2A router, settling
              through one escrow contract on BSC.
            </p>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-slate-500">
              Built for Build the Era — BNB Agent Studio Marketplace Hackathon
            </p>
            <a
              href={SOCIAL_LINKS.github}
              target="_blank"
              rel="noreferrer"
              className="glass mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-bnb/40 hover:text-white ring-focus"
            >
              <Github className="h-3.5 w-3.5" aria-hidden />
              Open source on GitHub
              <ArrowUpRight className="h-3 w-3 text-slate-500" aria-hidden />
            </a>
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

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col gap-4 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">© 2026 Bazar · Apache 2.0</p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="font-mono text-xs text-slate-500">
              Indexed block <span className="tabular text-slate-300">#{indexedBlock}</span>
            </p>
            <p className="inline-flex items-center gap-2 text-xs text-slate-400">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-bnb" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-bnb" />
              </span>
              ERC-8004 Indexer: <span className="font-medium text-bnb">live</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
