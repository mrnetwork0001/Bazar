'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  LogOut,
  Network,
  Wallet,
  X,
} from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';
import { BSC_CHAIN_ID, BSC_TESTNET_CHAIN_ID } from '@/lib/constants';
import { bscScanAddress, cn, shortAddress } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Pure helpers (also imported by components/wallet/connect-button)     */
/* ------------------------------------------------------------------ */

/** Human label for a chain id. Everything outside BSC 56 / 97 is unsupported. */
export function chainLabel(chainId: number): string {
  if (chainId === BSC_CHAIN_ID) return 'BNB Smart Chain';
  if (chainId === BSC_TESTNET_CHAIN_ID) return 'BSC Testnet';
  return 'Unsupported network';
}

interface WalletErrorLike {
  code?: unknown;
  name?: string;
  shortMessage?: string;
  message?: string;
  details?: string;
  cause?: unknown;
}

/** Walks the `cause` chain (viem nests its errors) and returns every link. */
function errorChain(error: unknown, depth = 0): WalletErrorLike[] {
  if (!error || typeof error !== 'object' || depth > 4) return [];
  const err = error as WalletErrorLike;
  return [err, ...errorChain(err.cause, depth + 1)];
}

/**
 * Turns a wagmi/viem connect or switch-chain error into one short, calm sentence.
 * Returns `''` for no error so callers can use it as a truthiness check.
 */
export function describeWalletError(error: unknown): string {
  if (!error) return '';

  const chain = errorChain(error);
  if (chain.length === 0) {
    const text = String(error).trim();
    return text && text !== '[object Object]' ? text : 'Wallet request failed. Please try again.';
  }

  const codes = chain.map((e) => (typeof e.code === 'number' ? e.code : undefined));
  const names = chain.map((e) => e.name ?? '');
  const text = chain
    .map((e) => e.shortMessage ?? e.message ?? e.details ?? '')
    .join(' ')
    .trim();

  if (
    codes.includes(4001) ||
    names.some((n) => n === 'UserRejectedRequestError') ||
    /user rejected|user denied|rejected the request|denied transaction/i.test(text)
  ) {
    return 'Request rejected in wallet.';
  }

  if (
    names.some((n) => n === 'ConnectorNotFoundError' || n === 'ProviderNotFoundError') ||
    /connector not found|provider not found|no injected|no ethereum provider/i.test(text)
  ) {
    return 'No injected wallet found.';
  }

  if (codes.includes(-32002) || /already pending|request of type .* already pending/i.test(text)) {
    return 'A wallet request is already open. Check your wallet.';
  }

  if (codes.includes(4902) || /unrecognized chain|chain .*not (been )?added/i.test(text)) {
    return 'Add BNB Smart Chain to your wallet, then try again.';
  }

  const first = (chain[0].shortMessage ?? chain[0].message ?? chain[0].details ?? '').split('\n')[0].trim();
  if (!first) return 'Wallet request failed. Please try again.';
  return first.length > 140 ? `${first.slice(0, 139)}…` : first;
}

/**
 * Formats a native balance for display.
 * Accepts either the raw `formatted` string (symbol rendered separately) or the
 * whole wagmi balance object, in which case the symbol is appended: `1.284 BNB`.
 */
export function formatBalance(value?: string | number | { formatted: string; symbol: string }): string {
  if (value === undefined || value === null) return '';

  if (typeof value === 'object') {
    const amount = formatBalance(value.formatted);
    return amount ? `${amount} ${value.symbol}` : '';
  }

  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return '';
  if (n === 0) return '0';
  if (n > 0 && n < 0.001) return '<0.001';
  return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

/* ------------------------------------------------------------------ */
/* Shared behaviour: Escape + outside click                            */
/* ------------------------------------------------------------------ */

function useDismiss(open: boolean, onClose: () => void, containerRef: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const node = containerRef.current;
      if (node && event.target instanceof Node && node.contains(event.target)) return;
      onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, onClose, containerRef]);
}

/** Anchored panel geometry, shared by the menu and the install hint. */
function panelClass(fullWidth?: boolean) {
  return cn(
    'glass-strong z-50 animate-fade-up overflow-hidden rounded-2xl shadow-card',
    fullWidth ? 'mt-2 w-full' : 'absolute right-0 top-full mt-2 w-64',
  );
}

const ITEM =
  'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white ring-focus';

/* ------------------------------------------------------------------ */
/* NetworkChip — navbar / mobile panel network indicator                */
/* ------------------------------------------------------------------ */

export interface NetworkChipProps {
  className?: string;
}

/**
 * Small always-on chip showing which network Bazar is talking to.
 * Renders the configured default chain until mount so SSR and CSR markup match.
 */
export function NetworkChip({ className }: NetworkChipProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const account = useAccount();
  const configChainId = useChainId();
  const chainId = mounted && account.chainId ? account.chainId : configChainId;
  const supported = chainId === BSC_CHAIN_ID || chainId === BSC_TESTNET_CHAIN_ID;
  const label = chainLabel(chainId);

  return (
    <span
      className={cn(
        'glass inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium',
        supported ? 'text-slate-300' : 'border-rose-500/30 text-rose-300',
        className,
      )}
      title={supported ? `Connected to ${label} (chain ${chainId})` : `Chain ${chainId} is not supported by Bazar`}
    >
      <span
        aria-hidden
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', supported ? 'bg-bnb' : 'bg-rose-400')}
      />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* WalletMenu — connected dropdown                                     */
/* ------------------------------------------------------------------ */

export interface WalletMenuProps {
  open: boolean;
  onClose: () => void;
  /** The relatively-positioned wrapper the menu is anchored to (used for outside-click). */
  containerRef: RefObject<HTMLDivElement>;
  address: string;
  chainId: number;
  balance?: { formatted: string; symbol: string };
  onDisconnect: () => void;
  fullWidth?: boolean;
}

export function WalletMenu({
  open,
  onClose,
  containerRef,
  address,
  chainId,
  balance,
  onDisconnect,
  fullWidth,
}: WalletMenuProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useDismiss(open, onClose, containerRef);

  // Reset the copied state whenever the menu closes, and never leak the timeout.
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!open) return null;

  const supported = chainId === BSC_CHAIN_ID || chainId === BSC_TESTNET_CHAIN_ID;
  const amount = formatBalance(balance);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div role="menu" aria-label="Wallet menu" className={panelClass(fullWidth)}>
      {/* Identity */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-3 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bnb/10 text-bnb ring-1 ring-inset ring-bnb/25">
          <Wallet className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-mono tabular text-sm font-medium text-white">{shortAddress(address, 6)}</p>
          <p className="text-[11px] text-slate-500">Connected wallet</p>
        </div>
      </div>

      {/* Actions */}
      <div role="none" className="py-1">
        <button type="button" role="menuitem" onClick={copyAddress} className={ITEM}>
          {copied ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
          ) : (
            <Copy className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          )}
          <span className="flex-1">{copied ? 'Address copied' : 'Copy address'}</span>
        </button>

        <a
          role="menuitem"
          href={bscScanAddress(address, chainId)}
          target="_blank"
          rel="noreferrer"
          onClick={onClose}
          className={ITEM}
        >
          <ExternalLink className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span className="flex-1">View on BscScan</span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
        </a>
      </div>

      {/* Facts */}
      <dl role="none" className="border-t border-white/[0.08] px-3 py-2.5 text-xs">
        <div className="flex items-center justify-between gap-3 py-1">
          <dt className="flex items-center gap-1.5 text-slate-500">
            <Network className="h-3.5 w-3.5" aria-hidden />
            Network
          </dt>
          <dd className={cn('flex items-center gap-1.5 font-medium', supported ? 'text-slate-200' : 'text-rose-300')}>
            <span
              aria-hidden
              className={cn('h-1.5 w-1.5 rounded-full', supported ? 'bg-bnb' : 'bg-rose-400')}
            />
            {chainLabel(chainId)}
          </dd>
        </div>
        {amount ? (
          <div className="flex items-center justify-between gap-3 py-1">
            <dt className="text-slate-500">Balance</dt>
            <dd className="tabular font-mono font-medium text-slate-200">{amount}</dd>
          </div>
        ) : null}
      </dl>

      {/* Disconnect */}
      <div role="none" className="border-t border-white/[0.08] py-1">
        <button
          type="button"
          role="menuitem"
          onClick={onDisconnect}
          className={cn(ITEM, 'text-rose-300 hover:bg-rose-500/10 hover:text-rose-200')}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">Disconnect</span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* WalletInstallHint — shown when no injected provider exists          */
/* ------------------------------------------------------------------ */

const WALLETS = [
  { name: 'MetaMask', domain: 'metamask.io', href: 'https://metamask.io/download/' },
  { name: 'Trust Wallet', domain: 'trustwallet.com', href: 'https://trustwallet.com/download' },
  { name: 'OKX Wallet', domain: 'okx.com/web3', href: 'https://www.okx.com/web3' },
  { name: 'Altana', domain: 'bnbchain.org', href: 'https://www.bnbchain.org' },
] as const;

export interface WalletInstallHintProps {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLDivElement>;
  fullWidth?: boolean;
}

/** Small glass popover listing BSC-compatible wallets when the browser has no provider. */
export function WalletInstallHint({ open, onClose, containerRef, fullWidth }: WalletInstallHintProps) {
  useDismiss(open, onClose, containerRef);

  if (!open) return null;

  return (
    <div role="dialog" aria-label="Install a wallet" className={cn(panelClass(fullWidth), !fullWidth && 'w-72')}>
      <div className="flex items-start gap-2 border-b border-white/[0.08] px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">No wallet detected</p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
            Install a BNB Smart Chain wallet, then reload this page.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss wallet install hint"
          className="-mr-1 shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:text-white ring-focus"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <ul className="py-1">
        {WALLETS.map((wallet) => (
          <li key={wallet.name}>
            <a
              href={wallet.href}
              target="_blank"
              rel="noreferrer"
              className={cn(ITEM, 'group')}
            >
              <Download className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-white">{wallet.name}</span>
                <span className="block truncate font-mono text-[10px] text-slate-500">{wallet.domain}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-bnb">
                Install
                <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5" aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
