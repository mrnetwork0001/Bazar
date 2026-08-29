'use client';

import { useSwitchChain } from 'wagmi';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Wallet } from '@/components/ui/icons';
import { BSC_MAINNET, type SupportedChainId } from '@/lib/chain/addresses';
import { formatBudget, PAYMENT_TOKEN_SYMBOL, type PaymentTokenPosition } from '@/lib/jobs/read';
import type { Address } from '@/lib/types';
import { bscScanAddress, shortAddress } from '@/lib/utils';

/**
 * Who the page is reading as, and what that wallet holds in the settlement
 * token.
 *
 * The balance is the kernel's own payment token - "United Stables", symbol `U`,
 * 18 decimals, read live from the token contract on both chains. It is not BNB,
 * and nothing on this page denominates a job in BNB. The allowance row is the
 * one that decides whether a funding transaction can succeed at all: `fund`
 * performs an ERC-20 `transferFrom`, so the kernel must be approved for at
 * least the budget first.
 */

const CHAIN_NAME: Record<SupportedChainId, string> = {
  [BSC_MAINNET]: 'BNB Smart Chain',
};

export interface WalletPanelProps {
  address: Address;
  /** The chain the wallet is actually on. May be one Bazar does not read. */
  walletChainId: number | undefined;
  /** The supported chain being read, or null when the wallet is on another network. */
  chainId: SupportedChainId | null;
  position: PaymentTokenPosition | null;
}

export function WalletPanel({ address, walletChainId, chainId, position }: WalletPanelProps) {
  const { switchChain, isPending } = useSwitchChain();

  return (
    <GlassCard className="w-full lg:max-w-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
          <Wallet className="h-3.5 w-3.5" aria-hidden />
          Reading as
        </span>
        <Badge tone={chainId ? 'emerald' : 'rose'}>{chainId ? 'Connected' : 'Unsupported network'}</Badge>
      </div>

      <a
        href={bscScanAddress(address, chainId ?? BSC_MAINNET)}
        target="_blank"
        rel="noreferrer"
        className="ring-focus mt-3 inline-flex items-center gap-1.5 font-mono text-lg text-white transition-colors hover:text-bnb"
      >
        {shortAddress(address, 6)}
      </a>

      <p className="mt-1 text-xs text-slate-500">
        {chainId ? `${CHAIN_NAME[chainId]} · chain ${chainId}` : `Chain ${walletChainId ?? 'unknown'}`}
      </p>

      {!chainId && (
        <div className="mt-4">
          <p className="text-xs leading-relaxed text-slate-400">
            Bazar reads the AgenticCommerce kernel on BNB Smart Chain. Switch networks to see this
            wallet&rsquo;s jobs - nothing is read from the chain it is on now.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => switchChain({ chainId: BSC_MAINNET })}
              loading={isPending}
            >
              Switch to BNB Chain
            </Button>
          </div>
        </div>
      )}

      {chainId && (
        <dl className="mt-4 space-y-2 border-t border-white/[0.07] pt-4 text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">Settlement token</dt>
            <dd className="font-mono tabular text-white">
              {position ? (
                `${formatBudget(position.balance, position.decimals)} ${position.symbol}`
              ) : (
                <span className="text-slate-500">not read</span>
              )}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">Approved to the kernel</dt>
            <dd className="font-mono tabular text-slate-300">
              {position ? (
                `${formatBudget(position.allowance, position.decimals)} ${position.symbol}`
              ) : (
                <span className="text-slate-500">not read</span>
              )}
            </dd>
          </div>
          <p className="pt-1 text-[11px] leading-snug text-slate-500">
            {position === null
              ? `The wallet's ${PAYMENT_TOKEN_SYMBOL} position has not come back from the token contract - either still reading, or the RPC did not answer.`
              : position.allowance === 0n
                ? 'Funding a job needs an ERC-20 approval first: the kernel moves the budget with transferFrom.'
                : 'The kernel may move up to this much on the wallet’s behalf when a job is funded.'}
          </p>
        </dl>
      )}
    </GlassCard>
  );
}
