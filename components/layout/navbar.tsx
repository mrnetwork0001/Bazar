'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { CirclePlus, Menu, X } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';
import { MobileNav, isActivePath } from '@/components/layout/mobile-nav';
import { ConnectButton } from '@/components/wallet/connect-button';
import { NetworkChip } from '@/components/wallet/wallet-menu';
import { NAV_LINKS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // Close the mobile panel whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <MotionConfig reducedMotion="user">
      <header className="sticky top-0 z-50">
        <nav
          aria-label="Primary"
          className="relative border-b border-white/[0.08] bg-ink/75 backdrop-blur-xl supports-[backdrop-filter]:bg-ink/60"
        >
          <div className="container-x flex h-16 items-center gap-4">
            {/* Left: logo */}
            <Link href="/" aria-label="Bazar home" className="shrink-0 rounded-lg ring-focus">
              <Logo size="sm" />
            </Link>

            {/*
              Center: primary links.

              This row appears at `lg`, not `md`. With five destinations the
              labels need ~450px, and between 768px and 1023px that left the
              connect button clipped off the right edge and wrapped "List an
              agent" onto three lines. The tablet band now gets the same
              slide-down panel as mobile, which lists every destination at full
              width, so nothing is lost by not painting the row there.
            */}
            <ul className="hidden flex-1 items-center justify-center gap-1 lg:flex">
              {NAV_LINKS.map((link) => {
                const active = isActivePath(pathname, link.href);
                return (
                  <li key={link.href} className="relative flex h-16 items-center">
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ring-focus',
                        active ? 'text-bnb' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
                      )}
                    >
                      {link.label}
                    </Link>
                    {active && (
                      <motion.span
                        layoutId="nav-active-underline"
                        aria-hidden
                        className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-bnb shadow-[0_0_12px_rgba(240,185,11,0.55)]"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Right: network, register, wallet, hamburger */}
            <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
              <NetworkChip className="hidden xl:inline-flex" />
              <Button
                variant="ghost"
                size="sm"
                href="/register"
                className="hidden xl:inline-flex"
                leftIcon={<CirclePlus className="h-3.5 w-3.5 text-bnb" aria-hidden />}
              >
                Register agent
              </Button>
              {/* The drawer carries a full-width Connect Wallet of its own, so
                  below lg this was the same control twice - and the one that
                  lost was the hamburger, squeezed against it on a narrow
                  header. */}
              <ConnectButton size="sm" className="hidden lg:inline-flex" />
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="mobile-nav"
                aria-label={open ? 'Close menu' : 'Open menu'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white ring-focus lg:hidden"
              >
                {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
              </button>
            </div>
          </div>

          <MobileNav open={open} onClose={close} pathname={pathname} />
        </nav>
      </header>
    </MotionConfig>
  );
}
