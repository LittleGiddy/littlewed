'use client';

import { motion } from 'framer-motion';
import { motionDuration, motionEase, useReducedMotion } from '@/lib/motion';

/**
 * Enter animation for every step of the send-invitation flow.
 *
 * A template (unlike a layout) remounts whenever a child segment changes, so
 * moving Channel -> Message -> Guests fades/rises the new screen instead of
 * snapping. Reduced-motion users get the final state immediately.
 */
export default function SendFlowTemplate({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : motionDuration.base, ease: motionEase }}
    >
      {children}
    </motion.div>
  );
}
