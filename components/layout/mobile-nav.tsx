'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CirclePlus, Database } from '@/components/ui/icons';
import { ConnectButton } from '@/components/wallet/connect-button';
import { NetworkChip } from '@/components/wallet/wallet-menu';
import { NAV_LINKS, SOCIAL_LINKS } from '@/lib/constants';
import { cn } from '@/lib/utils';

/** True when `href` is the current route or an ancestor of it. */
export function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  pathname: string | null;
}

/**
 * Slide-down glass panel rendered below the navbar on small and tablet screens,
 * up to the `lg` breakpoint where the navbar paints its own link row.
 * Escape, backdrop click, link click and crossing that breakpoint all close it.
 */
export function MobileNav({ open, onClose, pathname }: MobileNavProps) {
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    // Matches the navbar's `lg:flex` link row - the panel must close exactly
    // when that row takes over, not a breakpoint earlier.
    const media = window.matchMedia('(min-width: 1024px)');
    const onMedia = (event: MediaQueryListEvent) => {
      if (event.matches) onClose();
    };

    document.addEventListener('keydown', onKey);
    media.addEventListener('change', onMedia);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      media.removeEventListener('change', onMedia);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="mobile-nav-backdrop"
            aria-hidden
            className="absolute inset-x-0 top-full h-[100vh] bg-ink/70 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            key="mobile-nav-panel"
            id="mobile-nav"
            className="absolute inset-x-0 top-full z-10 border-b border-white/[0.08] bg-surface/95 shadow-card backdrop-blur-2xl lg:hidden"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="container-x space-y-5 py-5">
              <ul className="space-y-1">
                {NAV_LINKS.map((link) => {
                  const active = isActivePath(pathname, link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center justify-between rounded-xl px-3 py-2.5 text-base font-medium transition-colors ring-focus',
                          active ? 'bg-bnb/10 text-bnb' : 'text-slate-200 hover:bg-white/[0.05] hover:text-white',
                        )}
                      >
                        {link.label}
                        {active && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-bnb" />}
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <Link
                    href="/register"
                    onClick={onClose}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-medium text-slate-200 transition-colors hover:bg-white/[0.05] hover:text-white ring-focus"
                  >
                    <CirclePlus className="h-4 w-4 text-bnb" aria-hidden />
                    Register agent
                  </Link>
                </li>
              </ul>

              <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
                <NetworkChip />
                <a
                  href={SOCIAL_LINKS.indexer}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md text-xs text-slate-400 transition-colors hover:text-white ring-focus"
                >
                  <Database className="h-3.5 w-3.5" aria-hidden />
                  8004scan index
                </a>
              </div>

              <ConnectButton size="md" fullWidth />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
