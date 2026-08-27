'use client';

import { useCallback, useState } from 'react';
import { Zap } from 'lucide-react';
import type { Agent } from '@/lib/types';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/button';
import { HireModal } from '@/components/hire/hire-modal';

export interface HireButtonProps {
  agent: Agent;
  /** Pre-select a pricing tier when the modal opens. */
  tierId?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  label?: string;
  className?: string;
}

/**
 * Self-contained hire entry point: renders the trigger and owns the modal's
 * open state, so server components (the agent page, pricing cards) can drop the
 * whole escrow flow in without becoming client components themselves.
 */
export function HireButton({
  agent,
  tierId,
  size = 'md',
  variant = 'primary',
  label = 'Hire agent',
  className,
}: HireButtonProps) {
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        leftIcon={<Zap className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />}
      >
        {label}
      </Button>
      <HireModal agent={agent} open={open} onClose={handleClose} defaultTierId={tierId} />
    </>
  );
}
