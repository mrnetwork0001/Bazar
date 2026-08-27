'use client';

import { MotionConfig, motion } from 'framer-motion';
import type { ReactNode } from 'react';

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds */
  delay?: number;
  /** Initial translateY in px */
  y?: number;
}

/**
 * Subtle scroll-in reveal. Content starts partially visible (never opacity 0)
 * so a slow hydration never hides copy; `reducedMotion="user"` drops the
 * transform animation for users who prefer reduced motion.
 */
export function Reveal({ children, className, delay = 0, y = 16 }: RevealProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        initial={{ opacity: 0.3, y }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '0px 0px -48px 0px' }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
