'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'

const TEAM_ATTACK_DURATION_MS = 1600

// The "streaks can trigger visually exciting team attacks" requirement
// -- a celebratory, PUBLIC-but-never-negative banner shown to every
// participant when ANY classmate's streak crosses a team-attack
// threshold (see coopBattle.ts's streakTeamAttacksTriggered). Names the
// student who earned it -- unlike a wrong answer, celebrating who
// achieved a streak is a positive, opt-in-feeling spotlight, not
// shaming; the design constraint is specifically "no NEGATIVE public
// attribution", not "no attribution at all".
export function TeamAttackBanner({ nickname, onResolved }: { nickname: string; onResolved: () => void }) {
  const { reduced, celebrate } = useGameV2Motion()

  useEffect(() => {
    const timeout = window.setTimeout(onResolved, TEAM_ATTACK_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [onResolved])

  return (
    <motion.div
      role="status"
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={reduced ? { duration: 0.15 } : celebrate}
      className="w-full rounded-2xl bg-gradient-to-r from-gamev2spark-100 to-gamev2coral-100 dark:from-gamev2spark-500/20 dark:to-gamev2coral-500/20 border-2 border-gamev2spark-300 dark:border-gamev2spark-600 px-4 py-3 text-center"
    >
      <p className="text-sm font-extrabold text-gamev2ink-900 dark:text-white">
        {'⚡'} Team Attack! {nickname}&apos;s streak just hit the boss hard!
      </p>
    </motion.div>
  )
}
