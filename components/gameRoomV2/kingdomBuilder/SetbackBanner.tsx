'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'

const SETBACK_DURATION_MS = 1200

// The short, non-punitive consequence of a wrong answer -- calm,
// encouraging copy that never frames the moment as a failure or
// undoes anything already built (see
// lib/gameRoomV2/kingdomBuilder/kingdom.ts's applyWrongAnswer, which
// only ever eats into resources saved toward the NEXT building, never
// removes a completed one). Auto-dismisses; never blocks input or
// demands a retry action -- matching Space Mission's RecoveryBanner
// precedent for "recovery, not punishment."
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
        {'\u{1F477}'} A small setback -- your kingdom stands strong. Try the next one!
      </p>
    </motion.div>
  )
}
