import { ArrowUpRight, Coins, Fingerprint, Gavel, Scale, Vault } from '@/components/ui/icons';
import { GlassCard } from '@/components/ui/glass-card';
import { getDeployment } from '@/lib/chain/addresses';
import { cn, shortAddress } from '@/lib/utils';

type IconType = typeof Vault;

interface ContractEntry {
  label: string;
  role: string;
  address: string;
  icon: IconType;
}

/**
 * The contracts Bazar actually reads and will settle against, straight from
 * `lib/chain/addresses.ts` - the addresses the official BNB Agent Studio SDK
 * calls, not placeholders.
 *
 * This card replaced the fractional revenue-share panel. Fractional agent
 * tokens do not exist on BNB Chain: there is no supply, no holder count and no
 * APR to read, so there was nothing honest to render. Verifiable contract
 * addresses are the thing a reader can actually check.
 */
export function SettlementContracts({ className }: { className?: string }) {
  const d = getDeployment();

  const entries: ContractEntry[] = [
    {
      label: 'Identity Registry',
      role: 'ERC-8004 agent identity NFTs - the source of every agent on Bazar',
      address: d.identityRegistry,
      icon: Fingerprint,
    },
    {
      label: 'AgenticCommerce kernel',
      role: 'ERC-8183 job escrow: create, fund, submit, release',
      address: d.agenticCommerce,
      icon: Vault,
    },
    {
      label: 'Evaluator router',
      role: 'Routes a submitted deliverable to its evaluator',
      address: d.evaluatorRouter,
      icon: Gavel,
    },
    {
      label: 'Optimistic policy',
      role: 'Challenge window before an unevaluated job settles',
      address: d.optimisticPolicy,
      icon: Scale,
    },
    {
      label: 'Settlement token',
      role: 'ERC-20 the kernel pays out in',
      address: d.paymentToken,
      icon: Coins,
    },
  ];

  return (
    <GlassCard
      as="section"
      aria-labelledby="settlement-heading"
      padded={false}
      className={cn('overflow-hidden', className)}
    >
      <div className="border-b border-white/[0.06] px-5 py-4">
        <h2 id="settlement-heading" className="text-sm font-semibold text-white">
          Settlement contracts
        </h2>
        <p className="mt-0.5 text-xs leading-snug text-slate-500">
          {d.name} · chain {d.chainId}. Bazar reads the registry today and settles through the kernel in Phase 2.
        </p>
      </div>

      <ul className="divide-y divide-white/[0.06]">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <li key={entry.label}>
              <a
                href={`${d.explorer}/address/${entry.address}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`${entry.label} at ${shortAddress(entry.address)} on BscScan`}
                className="ring-focus flex items-start gap-3 px-5 py-3 transition-colors hover:bg-white/[0.03]"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-slate-300">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm text-white">
                    {entry.label}
                    <ArrowUpRight className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500">{entry.role}</span>
                  <span className="mt-1 block font-mono text-[11px] tabular text-slate-400">
                    {shortAddress(entry.address, 6)}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}
