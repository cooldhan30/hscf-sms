'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'

const SETBACK_DURATION_MS = 1200

// The short, non-punitive consequence of a wrong answer -- calm,
// encouraging copy, never framing the moment as failure and never
// removing a clue or unlocked room already earned (see
// lib/gameRoomV2/mysteryMansion/investigation.ts's applyWrongAnswer).
// Auto-dismisses; never blocks input or demands a retry action --
// matching Space Mission's RecoveryBanner / Kingdom Builder's
// SetbackBanner precedent for "recovery, not punishment."
export function SetbackBanner({ onResolved }: { onResolved: () => void }) {
  const { reduced } = useGameV2Motion()

  useEffect(() => {
    const timeout = window.setTimeout(onResolved, SETBACK_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [onResolved])

  return (
    <motion.div
      role="status"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full rounded-2xl bg-gamev2coral-50 dark:bg-gamev2coral-500/10 border border-gamev2coral-200 dark:border-gamev2coral-500/30 px-4 py-3 text-center"
    >
      <p className="text-sm font-bold text-gamev2coral-600 dark:text-gamev2coral-300">
        {'\u{1F914}'} Not quite -- but the trail is still warm. Keep investigating!
      </p>
    </motion.div>
  )
}
