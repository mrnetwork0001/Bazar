'use client';

import { useCallback, useState } from 'react';
import { Zap } from '@/components/ui/icons';
import type { IndexedAgent } from '@/lib/types';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/button';
import { HireModal } from '@/components/hire/hire-modal';

export interface HireButtonProps {
  agent: IndexedAgent;
  size?: ButtonSize;
  variant?: ButtonVariant;
  label?: string;
  className?: string;
}

/**
 * Hire entry point: renders the trigger and owns the dialog's open state, so a
 * server component can drop the whole flow in without becoming a client
 * component itself. No price is shown here or in the dialog - none exists.
 */
export function HireButton({
  agent,
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
      <HireModal agent={agent} open={open} onClose={handleClose} />
    </>
  );
}
