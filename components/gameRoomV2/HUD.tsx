'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { FiClock } from 'react-icons/fi'
import { useGameV2Motion } from './useGameV2Motion'

// The three HUD readouts every engine's play screen needs. Kept as
// small, focused components (not one monolithic "HUD bar") so an
// engine can lay them out however its own screen needs -- a quiz might
// put the timer top-center and XP/coins in corners, a racing game
// might hide the timer entirely.

export function GameV2Timer({ secondsRemaining, totalSeconds }: { secondsRemaining: number; totalSeconds: number }) {
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(100, (secondsRemaining / totalSeconds) * 100)) : 0
  const urgent = secondsRemaining <= 5

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-sm ${
        urgent
          ? 'bg-gamev2coral-500 text-white animate-pulse'
          : 'bg-gamev2ink-100 dark:bg-gamev2ink-800 text-gamev2ink-700 dark:text-gamev2ink-200'
      }`}
      role="timer"
      aria-live="polite"
      aria-label={`${secondsRemaining} seconds remaining`}
    >
      <FiClock className="w-4 h-4" aria-hidden />
      <span className="tabular-nums">{secondsRemaining}s</span>
      <span className="sr-only">{pct.toFixed(0)}% of time remaining</span>
    </div>
  )
}

export function GameV2XPDisplay({ xp, gained }: { xp: number; gained?: number | null }) {
  const { celebrate, reduced } = useGameV2Motion()

  return (
    <div className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gamev2ink-800 dark:bg-gamev2ink-700 text-white font-bold text-sm">
      <span aria-hidden>⭐</span>
      <span className="tabular-nums">{xp.toLocaleString()} XP</span>
      <AnimatePresence>
        {gained ? (
          <motion.span
            key={`${xp}-${gained}`}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 0, scale: 0.8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: -18, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={celebrate}
            className="absolute -top-1 right-0 text-gamev2spark-400 font-extrabold text-xs"
            aria-hidden
          >
            +{gained}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function GameV2CoinDisplay({ coins, gained }: { coins: number; gained?: number | null }) {
  const { celebrate, reduced } = useGameV2Motion()

  return (
    <div className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gamev2spark-100 dark:bg-gamev2spark-500/20 text-gamev2spark-800 dark:text-gamev2spark-300 font-bold text-sm">
      <span aria-hidden>🪙</span>
      <span className="tabular-nums">{coins.toLocaleString()}</span>
      <AnimatePresence>
        {gained ? (
          <motion.span
            key={`${coins}-${gained}`}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 0, scale: 0.8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: -18, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={celebrate}
            className="absolute -top-1 right-0 text-gamev2spark-600 dark:text-gamev2spark-400 font-extrabold text-xs"
            aria-hidden
          >
            +{gained}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
