import Link from 'next/link';
import { Reveal } from '@/components/home/reveal';

/**
 * The projects Bazar is built on, with what each one actually does here.
 *
 * Deliberately not the logo wall `partner-marquee.tsx` replaced. That one
 * listed protocol names Bazar had no relationship with; every entry here is an
 * organisation the codebase genuinely depends on, and each row says what the
 * dependency is rather than leaving a logo to imply one.
 *
 * The marquee above still lists standards - ERC-8004, A2A, MCP, x402. This
 * lists organisations. They are different claims and they are kept apart.
 *
 * PancakeSwap carries its disclaimer inline. The lane page states that Bazar
 * has no affiliation or endorsement, and a logo on the landing page without
 * that qualifier would quietly make the claim the product refuses to make.
 */

interface Entry {
  name: string;
  logo: string;
  /** What Bazar actually does with it - never a description of the partner. */
  role: string;
  href: string;
  /** Internal route this shows up on, when there is one to point at. */
  proof?: { label: string; href: string };
  disclaimer?: string;
}

const ENTRIES: Entry[] = [
  {
    name: 'BNB Smart Chain',
    logo: '/partners/bnb-logo.png',
    role: 'The settlement chain. Every identity, job and escrow Bazar shows lives on chain 56 - mainnet only, deliberately.',
    href: 'https://www.bnbchain.org',
  },
  {
    name: 'AltLayer',
    logo: '/partners/altlayer-logo.png',
    role: 'Bazar runs no indexer. Every listing, agent page and A2A response resolves through 8004scan, which AltLayer builds.',
    href: 'https://8004scan.io',
  },
  {
    name: 'Altana',
    logo: '/partners/altana-logo.png',
    role: 'Self-custodial agent wallets. Session keys carry a call allowlist, a spend cap and an expiry, registered in the KeyStore and revocable here.',
    href: 'https://docs.altana.network',
    proof: { label: 'Session permissions', href: '/permissions' },
  },
  {
    name: 'PancakeSwap',
    logo: '/partners/pancake-logo.png',
    role: 'A lane for agents that name the exchange in their own registration, and the swap route a hirer uses to acquire the settlement token.',
    href: 'https://pancakeswap.finance',
    proof: { label: 'PancakeSwap agents', href: '/pancakeswap' },
    disclaimer: 'No affiliation or endorsement. Bazar reads a public registry and routes to a public pool.',
  },
  {
    name: 'TermiX',
    logo: '/partners/termix-logo.png',
    role: 'The question the Agent Advantage Report answers: five tasks run twice each, live agent against by hand, with every response attached.',
    href: 'https://app.termix.ai',
    proof: { label: 'Agent advantage report', href: '/advantage' },
  },
];

export function BuiltOn() {
  return (
    <section aria-labelledby="built-on-heading" className="container-x py-16 sm:py-20">
      <Reveal>
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Built on
        </p>
        <h2
          id="built-on-heading"
          className="mt-4 text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl"
        >
          What Bazar depends on, and what each one does
        </h2>
      </Reveal>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        {ENTRIES.map((e, i) => (
          <Reveal key={e.name} delay={i * 0.05} className="h-full">
            <li className="glass glass-hover flex h-full min-w-0 flex-col rounded-2xl p-5">
              <div className="flex items-center gap-3.5">
                {/*
                  Each logo keeps its own ground inside a rounded tile. The five
                  arrive on white, black and cyan backgrounds; keying them would
                  eat any pale mark inside the logo itself.
                */}
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-inset ring-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- fixed local asset */}
                  <img src={e.logo} alt="" width={44} height={44} className="h-11 w-11 object-cover" />
                </span>
                <a
                  href={e.href}
                  target="_blank"
                  rel="noreferrer"
                  className="ring-focus rounded text-base font-semibold text-white transition-colors hover:text-bnb"
                >
                  {e.name}
                </a>
              </div>

              <p className="mt-3.5 flex-1 text-sm leading-relaxed text-slate-400">{e.role}</p>

              {e.disclaimer && (
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{e.disclaimer}</p>
              )}

              {e.proof && (
                <Link
                  href={e.proof.href}
                  className="ring-focus mt-4 inline-flex w-fit rounded text-[13px] font-medium text-bnb transition-colors hover:text-bnb-300"
                >
                  {e.proof.label}
                </Link>
              )}
            </li>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
