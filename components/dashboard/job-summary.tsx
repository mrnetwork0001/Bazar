'use client';

import { GlassCard } from '@/components/ui/glass-card';
import { CheckCircle2, Layers, Lock, RotateCcw } from '@/components/ui/icons';
import { holdsEscrow } from '@/lib/jobs/lifecycle';
import { formatBudgetLabel, type KernelInfo, type OnchainJob } from '@/lib/jobs/read';
import { cn } from '@/lib/utils';

/**
 * Four totals, each a plain sum over jobs actually read from the kernel.
 *
 * Every tile is labelled "in the scanned window" because that is the only thing
 * these numbers can honestly claim: the discovery sources are bounded and, on
 * mainnet, lossy. A lifetime total would require a complete history Bazar
 * cannot get from a public RPC.
 *
 * The "released" tile leans on a measured fact, and checks it rather than
 * assuming it. `platformFeeBP` was 0 on both chains on 2026-08-28, so a
 * completed job released exactly its budget to the provider. The tile reads
 * `platformFeeBP` live and drops the "to providers" claim if it is ever
 * non-zero, because then the budget and the payout are no longer the same
 * number.
 */

interface Tile {
  label: string;
  value: string;
  hint: string;
  icon: typeof Layers;
  accent: string;
}

export function JobSummary({
  jobs,
  kernel,
  className,
}: {
  jobs: readonly OnchainJob[];
  kernel: KernelInfo | null;
  className?: string;
}) {
  const escrowed = jobs.filter((j) => holdsEscrow(j.status));
  const completed = jobs.filter((j) => j.status === 'completed');
  const refunded = jobs.filter((j) => j.status === 'expired');

  const sum = (list: readonly OnchainJob[]) => list.reduce((total, job) => total + job.budget, 0n);

  const feeIsZero = kernel !== null && kernel.platformFeeBP === 0n;

  const tiles: Tile[] = [
    {
      label: 'Jobs found',
      value: jobs.length.toLocaleString('en-US'),
      hint: 'opened by this wallet, in the scanned window',
      icon: Layers,
      accent: 'text-slate-300',
    },
    {
      label: 'Escrowed now',
      value: formatBudgetLabel(sum(escrowed)),
      hint: `${escrowed.length} job${escrowed.length === 1 ? '' : 's'} funded or submitted`,
      icon: Lock,
      accent: 'text-bnb',
    },
    {
      label: 'Released',
      value: formatBudgetLabel(sum(completed)),
      hint: feeIsZero
        ? `${completed.length} completed - paid to the provider in full, platformFeeBP is 0`
        : `budget of ${completed.length} completed job${completed.length === 1 ? '' : 's'}`,
      icon: CheckCircle2,
      accent: 'text-emerald-300',
    },
    {
      label: 'Refunded',
      value: formatBudgetLabel(sum(refunded)),
      hint: `${refunded.length} expired and claimed back`,
      icon: RotateCcw,
      accent: 'text-violet-300',
    },
  ];

  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <GlassCard key={tile.label} className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon className={cn('h-3.5 w-3.5 shrink-0', tile.accent)} aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{tile.label}</span>
            </div>
            <p className="mt-2 break-words font-mono text-lg tabular text-white">{tile.value}</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">{tile.hint}</p>
          </GlassCard>
        );
      })}
    </div>
  );
}
