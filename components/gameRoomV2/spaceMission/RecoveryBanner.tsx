'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'

const RECOVERY_DURATION_MS = 1400

// The short, non-punitive consequence of a wrong answer -- a brief
// "rerouting power" beat the ship visibly recovers from on its own
// (auto-dismisses; never blocks input or demands a retry action). This
// is deliberately calm, encouraging copy, never a fail/game-over
// framing -- matching the "never humiliating or overly punitive"
// requirement.
export function RecoveryBanner({ onResolved }: { onResolved: () => void }) {
  const { reduced } = useGameV2Motion()

  useEffect(() => {
    const timeout = window.setTimeout(onResolved, RECOVERY_DURATION_MS)
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
        {'\u{1F6E1}\u{FE0F}'} Rerouting power... shields holding steady.
      </p>
    </motion.div>
  )
}
