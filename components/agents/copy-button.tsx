'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CopyButtonProps {
  /** Exact text placed on the clipboard. */
  value: string;
  /** What is being copied, used to build the aria-label (e.g. "agent address"). */
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}

/** Clipboard write with a synchronous fallback for browsers without the async API. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Icon-only copy control. Swaps to a check mark for ~1.5s after a successful
 * copy and announces the result to screen readers via a polite live region.
 */
export function CopyButton({ value, label, className, size = 'sm' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    const ok = await writeClipboard(value);
    if (!ok) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }, [value]);

  const box = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
        title={copied ? 'Copied' : `Copy ${label}`}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-400',
          'transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.07] hover:text-white ring-focus',
          copied && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
          box,
          className,
        )}
      >
        {copied ? <Check className={icon} aria-hidden /> : <Copy className={icon} aria-hidden />}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copied to clipboard` : ''}
      </span>
    </>
  );
}
