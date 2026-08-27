import { Sparkles } from 'lucide-react';
import { ConnectButton } from '@/components/wallet/connect-button';
import { cn } from '@/lib/utils';

export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        'relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-bnb/25 bg-bnb/[0.05] px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-bnb" />
      <div className="flex items-start gap-3 sm:items-center">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bnb/15 text-bnb">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium text-white">Demo mode — connect a wallet to see your own hires</p>
          <p className="mt-0.5 text-xs text-slate-400">
            You are viewing the Bazar demo wallet. Escrow positions, SLA progress and payouts below are sample data.
          </p>
        </div>
      </div>
      <ConnectButton size="sm" className="shrink-0 self-start sm:self-auto" />
    </div>
  );
}
