'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, TriangleAlert, Wallet, X } from '@/components/ui/icons';
import { useAccount, useBalance, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import {
  WalletInstallHint,
  WalletMenu,
  chainLabel,
  describeWalletError,
  formatBalance,
} from '@/components/wallet/wallet-menu';
import { BSC_CHAIN_ID } from '@/lib/constants';
import { cn, shortAddress } from '@/lib/utils';
import { useBnbName } from '@/components/wallet/use-bnb-name';

export type ConnectButtonSize = 'sm' | 'md' | 'lg';

export interface ConnectButtonProps {
  size?: ConnectButtonSize;
  className?: string;
  fullWidth?: boolean;
}

/** Connected-state pill sizing, matched 1:1 to Button sizes so the control never shifts layout. */
const PILL: Record<ConnectButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-xs',
  md: 'h-10 gap-2 rounded-xl px-3.5 text-sm',
  lg: 'h-12 gap-2.5 rounded-xl px-5 text-base',
};
const ICON: Record<ConnectButtonSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

function hasInjectedProvider() {
  if (typeof window === 'undefined') return false;
  return Boolean((window as Window & { ethereum?: unknown }).ethereum);
}

/**
 * Wallet control used in the navbar, mobile panel and hire flows.
 *
 * States: pre-mount skeleton (identical to disconnected so SSR/CSR markup matches) ->
 * disconnected -> connecting / reconnecting -> wrong network -> connected (BSC 56 / 97).
 */
export function ConnectButton({ size = 'md', className, fullWidth }: ConnectButtonProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const account = useAccount();
  // A BNB Chain marketplace should call people by their BNB Chain name.
  const bnbName = useBnbName(account.address);
  const configChainId = useChainId();
  const { connect, connectors, isPending: isConnecting, error: connectError, reset: resetConnect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching, error: switchError, reset: resetSwitch } = useSwitchChain();

  const [menuOpen, setMenuOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeHint = useCallback(() => setHintOpen(false), []);

  const address = account.address;
  const chainId = account.chainId ?? configChainId;
  const onBsc = chainId === BSC_CHAIN_ID;
  const connected = mounted && account.status === 'connected' && Boolean(address);

  const { data: balance } = useBalance({
    address,
    query: { enabled: connected && onBsc, staleTime: 15_000 },
  });

  const clearErrors = () => {
    resetConnect();
    resetSwitch();
  };

  const handleConnect = () => {
    clearErrors();
    setMenuOpen(false);
    const connector = connectors.find((c) => c.id === 'injected') ?? connectors[0];
    if (!connector || !hasInjectedProvider()) {
      setHintOpen(true);
      return;
    }
    setHintOpen(false);
    connect({ connector });
  };

  const handleSwitch = () => {
    clearErrors();
    switchChain({ chainId: BSC_CHAIN_ID });
  };

  const handleDisconnect = () => {
    setMenuOpen(false);
    clearErrors();
    disconnect();
  };

  const iconCls = ICON[size];
  const widthCls = fullWidth ? 'w-full' : undefined;
  const errorMessage = describeWalletError(connectError ?? switchError);

  const disconnectedButton = (
    <Button
      type="button"
      size={size}
      className={widthCls}
      onClick={handleConnect}
      loading={mounted && isConnecting}
      leftIcon={<Wallet className={iconCls} aria-hidden />}
      aria-expanded={hintOpen || undefined}
    >
      Connect Wallet
    </Button>
  );

  let control: ReactNode;

  if (!mounted || account.status === 'disconnected') {
    control = disconnectedButton;
  } else if (account.status === 'connecting' || account.status === 'reconnecting') {
    control = (
      <Button type="button" size={size} variant="secondary" className={widthCls} loading disabled>
        {account.status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
      </Button>
    );
  } else if (!address) {
    control = disconnectedButton;
  } else if (!onBsc) {
    control = (
      <Button
        type="button"
        size={size}
        variant="danger"
        className={widthCls}
        onClick={handleSwitch}
        loading={isSwitching}
        leftIcon={<TriangleAlert className={iconCls} aria-hidden />}
        title={`Connected to chain ${chainId}. Bazar runs on BNB Smart Chain.`}
      >
        Switch to BSC
      </Button>
    );
  } else {
    control = (
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Wallet ${bnbName ?? shortAddress(address)} on ${chainLabel(chainId)}`}
        className={cn(
          'glass inline-flex items-center justify-center whitespace-nowrap font-medium text-white transition-all duration-200 hover:border-bnb/40 hover:bg-white/[0.08] ring-focus',
          PILL[size],
          widthCls,
        )}
      >
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-bnb opacity-70 animate-pulse-ring" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-bnb" />
        </span>
        {balance && size !== 'sm' ? (
          <span className="font-mono tabular text-slate-300">
            {formatBalance(balance.formatted)} {balance.symbol}
          </span>
        ) : null}
        <span className={cn(bnbName ? 'font-medium' : 'font-mono tabular')}>{bnbName ?? shortAddress(address)}</span>
        <ChevronDown
          className={cn(iconCls, 'text-slate-400 transition-transform duration-200', menuOpen && 'rotate-180')}
          aria-hidden
        />
      </button>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', fullWidth ? 'block w-full' : 'inline-flex', className)}>
      {control}

      {address && onBsc ? (
        <WalletMenu
          open={menuOpen}
          onClose={closeMenu}
          containerRef={containerRef}
          address={address}
          chainId={chainId}
          balance={balance ? { formatted: balance.formatted, symbol: balance.symbol } : undefined}
          onDisconnect={handleDisconnect}
          fullWidth={fullWidth}
        />
      ) : null}

      <WalletInstallHint open={hintOpen} onClose={closeHint} containerRef={containerRef} fullWidth={fullWidth} />

      {errorMessage ? (
        <div
          role="alert"
          className={cn(
            'z-50 flex items-start gap-2 rounded-lg border border-rose-500/25 bg-ink/95 px-2.5 py-2 text-[11px] leading-snug text-rose-200 shadow-card backdrop-blur-xl',
            fullWidth ? 'mt-2' : 'absolute right-0 top-full mt-1.5 w-max max-w-[18rem]',
          )}
        >
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-rose-300" aria-hidden />
          <span className="flex-1">{errorMessage}</span>
          <button
            type="button"
            onClick={clearErrors}
            aria-label="Dismiss wallet error"
            className="-mr-1 -mt-0.5 rounded-md p-0.5 text-rose-300/80 transition-colors hover:text-white ring-focus"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
