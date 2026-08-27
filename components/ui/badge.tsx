import type { ReactNode } from 'react';
import { BadgeCheck, ShieldCheck, Trophy, HeartPulse, Network, Plug, PieChart, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BadgeId } from '@/lib/types';

export type BadgeTone = 'gold' | 'cyan' | 'emerald' | 'violet' | 'rose' | 'slate' | 'sky';

const tones: Record<BadgeTone, string> = {
  gold: 'bg-bnb/10 text-bnb border-bnb/30',
  cyan: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',
  emerald: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
  violet: 'bg-violet-400/10 text-violet-300 border-violet-400/30',
  rose: 'bg-rose-400/10 text-rose-300 border-rose-400/30',
  sky: 'bg-sky-400/10 text-sky-300 border-sky-400/30',
  slate: 'bg-white/[0.06] text-slate-300 border-white/10',
};

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
  size?: 'sm' | 'md';
  title?: string;
}

export function Badge({ tone = 'slate', icon, className, children, size = 'sm', title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export const BADGE_META: Record<
  BadgeId,
  { label: string; tone: BadgeTone; icon: typeof BadgeCheck; description: string }
> = {
  'erc8004-verified': {
    label: 'ERC-8004 Verified',
    tone: 'gold',
    icon: BadgeCheck,
    description: 'Identity NFT verified on the ERC-8004 Identity Registry (BSC).',
  },
  validated: {
    label: 'Validated',
    tone: 'sky',
    icon: ShieldCheck,
    description: 'Passed independent checks recorded in the ERC-8004 Validation Registry.',
  },
  'pancakeswap-top-trader': {
    label: 'PancakeSwap Top Trader',
    tone: 'cyan',
    icon: Trophy,
    description: 'Top-decile 30-day realized ROI on PancakeSwap.',
  },
  'venus-risk-monitor': {
    label: 'Venus Risk Monitor',
    tone: 'emerald',
    icon: HeartPulse,
    description: 'Certified Venus Protocol health-factor monitor.',
  },
  'a2a-ready': {
    label: 'A2A Ready',
    tone: 'violet',
    icon: Network,
    description: 'Hireable programmatically via the Bazar A2A router.',
  },
  'mcp-enabled': {
    label: 'MCP',
    tone: 'violet',
    icon: Plug,
    description: 'Exposes a Model Context Protocol server.',
  },
  fractional: {
    label: 'Fractional',
    tone: 'rose',
    icon: PieChart,
    description: 'Offers revenue-share tokens to supporters.',
  },
  'top-rated': {
    label: 'Top Rated',
    tone: 'gold',
    icon: Star,
    description: 'Reputation score in the top 5% of its category.',
  },
};

export function AgentBadge({ badge, size = 'sm', className }: { badge: BadgeId; size?: 'sm' | 'md'; className?: string }) {
  const meta = BADGE_META[badge];
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone} size={size} className={className} title={meta.description} icon={<Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />}>
      {meta.label}
    </Badge>
  );
}
