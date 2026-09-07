import type { Metadata } from 'next';

import { PermissionsConsole } from '@/components/altana/permissions-console';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import { ALTANA_MAINNET, ALTANA_TESTNET } from '@/lib/altana/config';
import { HIRE_SIGNATURES } from '@/lib/altana/scope';
import { shortAddress } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Agent permissions',
  description:
    'Grant an agent a session key on your own Altana wallet with a call allowlist, a spend cap and an expiry, see every key the KeyStore holds for you, and revoke any of them onchain.',
};

/**
 * Agent permissions.
 *
 * The question this page answers is the one a marketplace usually dodges: if an
 * agent is going to spend your money, what exactly may it do, who says so, and
 * how do you take it back?
 *
 * The answer here is not a policy document. It is two contracts. The Altana
 * KeyStore is a public registry of which keys are authorized for an account and
 * whether they are still live; the account contract holds the allowlist and the
 * spending caps and refuses anything outside them at validation time. This page
 * reads both, shows what they say, and gives you a revoke button that writes to
 * them.
 */
export default function PermissionsPage() {
  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-hero-glow opacity-70" aria-hidden />
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60" aria-hidden />

      <main className="container-x pb-24 pt-10 sm:pt-14">
        <div className="max-w-2xl">
          <Badge tone="slate" className="font-mono">
            Altana KeyStore + session keys
          </Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gradient-white sm:text-5xl">
            Agent permissions
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            An agent that can hire on your behalf needs to spend your money without asking you every time.
            That is only safe if the permission is narrow, bounded, time-limited, visible to anyone, and
            revocable in one transaction. Here it is all five, and every claim on this page is a contract read
            you can repeat yourself.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <PermissionsConsole />

          <aside className="space-y-4">
            <GlassCard>
              <h2 className="text-sm font-medium text-white">Two contracts, two jobs</h2>
              <dl className="mt-3 space-y-3 text-xs leading-relaxed text-slate-400">
                <div>
                  <dt className="font-medium text-slate-200">KeyStore - who is authorized</dt>
                  <dd className="mt-1">
                    The public registry. <span className="font-mono">isValidKey</span> answers registered,
                    unexpired and unrevoked, to anyone who asks - a counterparty, a tool, another agent. It
                    holds no scope, and this page never pretends it does.
                  </dd>
                  <dd className="mt-1 font-mono text-[11px] text-slate-500">
                    {shortAddress(ALTANA_MAINNET.keyStore)} on chain 56
                    <br />
                    {shortAddress(ALTANA_TESTNET.keyStore)} on chain 97
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-200">The account - what they may do</dt>
                  <dd className="mt-1">
                    The wallet itself. <span className="font-mono">canExecute</span> decides each call and{' '}
                    <span className="font-mono">spendInfos</span> holds the caps and how much of each has been
                    spent. A call outside the grant reverts at validation time, before it executes.
                  </dd>
                </div>
              </dl>
            </GlassCard>

            <GlassCard>
              <h2 className="text-sm font-medium text-white">What a hiring key may call</h2>
              <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-slate-400">
                {Object.entries(HIRE_SIGNATURES).map(([name, signature]) => (
                  <li key={name}>
                    <span className="block truncate font-mono text-slate-300">{signature}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Six selectors on three contracts, and the payment-token approval only ever names the kernel.
                No transfer, no settle, no dispute. Every signature above is derived from the ABIs the hire
                path itself encodes, so the grant and the calls cannot disagree.
              </p>
            </GlassCard>

            <GlassCard>
              <h2 className="text-sm font-medium text-white">Where the keys live</h2>
              <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-slate-400">
                <li>
                  <span className="font-medium text-slate-200">Admin authority:</span> a WebAuthn passkey in
                  your device&apos;s secure element. It signs grants and revokes. Bazar stores its public half
                  only.
                </li>
                <li>
                  <span className="font-medium text-slate-200">Session key:</span> a secp256k1 key generated in
                  your browser and kept in localStorage, so an agent can act after a reload. It is bounded by
                  the allowlist, the cap and the expiry - which is the whole point of bounding it.
                </li>
                <li>
                  <span className="font-medium text-slate-200">Bazar:</span> holds neither. There is no server
                  in this flow.
                </li>
              </ul>
            </GlassCard>
          </aside>
        </div>
      </main>
    </div>
  );
}
