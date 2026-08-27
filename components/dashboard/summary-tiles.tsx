import { Activity, HandCoins, Lock, Network, ShieldCheck } from 'lucide-react';
import type { Hire } from '@/lib/types';
import { clamp, cn, formatToken } from '@/lib/utils';
import { isInFlight, isSettled } from './hire-helpers';

type IconType = typeof Activity;
type Accent = 'gold' | 'cyan' | 'emerald' | 'violet' | 'slate';

export interface DashboardSummary {
  active: number;
  total: number;
  escrowedBnb: number;
  escrowedUsdt: number;
  releasedBnb: number;
  releasedUsdt: number;
  avgSla: number;
  a2a: number;
}

function sumWhere(hires: Hire[], currency: Hire['currency'], pred: (h: Hire) => boolean) {
  return hires.filter((h) => h.currency === currency && pred(h)).reduce((acc, h) => acc + h.amount, 0);
}

export function computeSummary(hires: Hire[]): DashboardSummary {
  const inFlight = hires.filter(isInFlight);
  const pool = inFlight.length ? inFlight : hires;
  const avgSla = pool.length ? Math.round(pool.reduce((acc, h) => acc + h.slaProgress, 0) / pool.length) : 0;
  return {
    active: inFlight.length,
    total: hires.length,
    escrowedBnb: sumWhere(hires, 'BNB', (h) => !isSettled(h)),
    escrowedUsdt: sumWhere(hires, 'USDT', (h) => !isSettled(h)),
    releasedBnb: sumWhere(hires, 'BNB', (h) => h.status === 'released'),
    releasedUsdt: sumWhere(hires, 'USDT', (h) => h.status === 'released'),
    avgSla,
    a2a: hires.filter((h) => h.source === 'a2a').length,
  };
}

const ACCENT: Record<Accent, { card: string; icon: string; value: string }> = {
  gold: {
    card: 'border-bnb/30 bg-bnb/[0.06] bg-gold-radial shadow-glow-sm hover:border-bnb/50',
    icon: 'bg-bnb/15 text-bnb',
    value: 'text-bnb',
  },
  cyan: { card: 'border-white/[0.08] bg-white/[0.04] hover:border-cyan-400/30', icon: 'bg-cyan-400/10 text-cyan-300', value: 'text-white' },
  emerald: { card: 'border-white/[0.08] bg-white/[0.04] hover:border-emerald-400/30', icon: 'bg-emerald-400/10 text-emerald-300', value: 'text-white' },
  violet: { card: 'border-white/[0.08] bg-white/[0.04] hover:border-violet-400/30', icon: 'bg-violet-400/10 text-violet-300', value: 'text-white' },
  slate: { card: 'border-white/[0.08] bg-white/[0.04] hover:border-white/20', icon: 'bg-white/[0.06] text-slate-300', value: 'text-white' },
};

interface TileProps {
  label: string;
  value: string;
  sub: string;
  icon: IconType;
  accent: Accent;
  /** Optional 0-100 bar under the value */
  progress?: number;
}

function Tile({ label, value, sub, icon: Icon, accent, progress }: TileProps) {
  const a = ACCENT[accent];
  // Plain string concat (not cn) so the gold accent's border/background reliably override the defaults.
  const cardClass = `rounded-2xl border p-4 shadow-card backdrop-blur-xl transition-colors duration-300 sm:p-5 ${a.card}`;
  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', a.icon)}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <p className={cn('mt-3 truncate font-mono text-2xl font-semibold leading-none tabular', a.value)}>{value}</p>
      {progress !== undefined && (
        <div
          className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-label="Average SLA progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clamp(progress, 0, 100)}
        >
          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${clamp(progress, 0, 100)}%` }} />
        </div>
      )}
      <p className="mt-2 truncate text-xs text-slate-500">{sub}</p>
    </div>
  );
}

export function SummaryTiles({ hires, className }: { hires: Hire[]; className?: string }) {
  const s = computeSummary(hires);
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5', className)} aria-label="Escrow summary">
      <Tile label="Active hires" value={String(s.active)} sub={`of ${s.total} total hires`} icon={Activity} accent="cyan" />
      <Tile
        label="Total escrowed"
        value={formatToken(s.escrowedBnb, 'BNB')}
        sub={s.escrowedUsdt > 0 ? `+ ${formatToken(s.escrowedUsdt, 'USDT')} locked` : 'Locked in the Bazar escrow contract'}
        icon={Lock}
        accent="gold"
      />
      <Tile
        label="Released to agents"
        value={formatToken(s.releasedBnb, 'BNB')}
        sub={s.releasedUsdt > 0 ? `+ ${formatToken(s.releasedUsdt, 'USDT')} released` : 'Paid out after SLA verification'}
        icon={HandCoins}
        accent="emerald"
      />
      <Tile label="Avg SLA progress" value={`${s.avgSla}%`} sub="Across in-flight hires" icon={ShieldCheck} accent="slate" progress={s.avgSla} />
      <Tile label="A2A hires" value={String(s.a2a)} sub="Placed by other agents via the router" icon={Network} accent="violet" />
    </div>
  );
}
