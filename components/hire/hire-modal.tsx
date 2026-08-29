'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { X } from '@/components/ui/icons';
import { AgentAvatar } from '@/components/agents/agent-header';
import { HireFlow } from '@/components/hire/hire-flow';
import type { IndexedAgent } from '@/lib/types';

/* ------------------------------ focus utils ----------------------------- */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/* -------------------------------- modal --------------------------------- */

export interface HireModalProps {
  agent: IndexedAgent;
  open: boolean;
  onClose: () => void;
}

/**
 * The dialog that hires an ERC-8004 agent.
 *
 * This component owns nothing but the shell - portal, focus trap, scroll lock,
 * header. Everything that touches the chain lives in `HireFlow`, which runs the
 * four real transactions against the ERC-8183 AgenticCommerce kernel.
 *
 * Closing the dialog unmounts the flow, which stops it writing state - it does
 * NOT stop a transaction. Anything already broadcast lands onchain regardless,
 * which is why the job id is written to `job-receipts` the moment `createJob`
 * confirms rather than at the end of the sequence. `resetKey` is bumped on each
 * open so a reopened dialog starts clean.
 */
export function HireModal({ agent, open, onClose }: HireModalProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /** Incremented on each open, handed to the flow so it can clear itself. */
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    if (open) setResetKey((n) => n + 1);
  }, [open]);

  /* -------- escape + focus trap -------- */
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableIn(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      const inside = panelRef.current?.contains(active);
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  /* -------- move focus in, and back to the trigger on close -------- */
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, [open]);

  /* -------- body scroll lock -------- */
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  if (!mounted) return null;

  const transition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' as const };
  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 18, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 12, scale: 0.98 },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="bazar-hire-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4"
        >
          <div aria-hidden onClick={onClose} className="absolute inset-0 bg-ink/80 backdrop-blur-md" />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            {...panelMotion}
            transition={transition}
            className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/[0.12] bg-surface/95 shadow-card backdrop-blur-2xl sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start gap-3 border-b border-white/[0.08] p-4 sm:p-5">
              <AgentAvatar agent={agent} className="h-10 w-10 rounded-xl text-xs" />
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="truncate text-base font-semibold text-white">
                  Hire {agent.name}
                </h2>
                <p id={descriptionId} className="mt-0.5 text-xs text-slate-400">
                  A real ERC-8183 job on the AgenticCommerce kernel: you set the brief and the budget, your wallet
                  signs, and the kernel holds the escrow. No registry publishes a price, so Bazar quotes none.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close hire dialog"
                className="ring-focus -mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <HireFlow agent={agent} onClose={onClose} resetKey={resetKey} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
