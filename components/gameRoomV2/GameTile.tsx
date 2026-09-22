'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useGameV2Motion } from './useGameV2Motion'
import { GameV2StatusPill } from './GameV2StatusPill'
import type { GameEngineStatus } from '@/lib/gameRoomV2/domain'

// A game-picker tile -- the thing a student taps to launch a game
// engine. Deliberately game-console-shelf styling (large, colorful,
// icon-forward) rather than a table row or a generic admin "card list
// item". `accent` lets each engine carry its own identity color (per
// the "game-specific accent colors while maintaining a consistent
// Tamizhi identity" requirement) without every tile looking identical.
const ACCENT_CLASSES = {
  ink: 'from-gamev2ink-600 to-gamev2ink-800',
  coral: 'from-gamev2coral-400 to-gamev2coral-600',
  mint: 'from-gamev2mint-400 to-gamev2mint-600',
  cyan: 'from-gamev2cyan-400 to-gamev2cyan-600',
  magenta: 'from-gamev2magenta-400 to-gamev2magenta-600',
  lime: 'from-gamev2lime-400 to-gamev2lime-600',
} as const

export type GameTileAccent = keyof typeof ACCENT_CLASSES

export function GameTile({
  title,
  tamilTitle,
  icon,
  accent = 'ink',
  status,
  disabled = false,
  onClick,
}: {
  title: string
  tamilTitle?: string | null
  icon: ReactNode
  accent?: GameTileAccent
  status: GameEngineStatus
  disabled?: boolean
  onClick?: () => void
}) {
  const { spring, reduced } = useGameV2Motion()
  const isPlayable = status === 'ACTIVE' || status === 'BETA'
  const interactive = !disabled && isPlayable

  return (
    <motion.button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      whileHover={interactive && !reduced ? { y: -6, rotate: -0.5 } : undefined}
      whileTap={interactive && !reduced ? { y: -2, scale: 0.98 } : undefined}
      transition={spring}
      aria-disabled={!interactive}
      className={`relative text-left rounded-3xl overflow-hidden border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-white dark:bg-gamev2ink-900 shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400 ${
        interactive ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
      }`}
    >
      <div className={`h-28 sm:h-32 flex items-center justify-center bg-gradient-to-br ${ACCENT_CLASSES[accent]} text-white`}>
        <div className={`text-5xl ${interactive ? 'animate-gamev2-idle-float' : ''}`} aria-hidden>
          {icon}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-extrabold text-gamev2ink-900 dark:text-white leading-tight">{title}</p>
            {tamilTitle && (
              <p className="font-tamil text-sm text-gamev2ink-500 dark:text-gamev2ink-400 leading-relaxed mt-0.5">
                {tamilTitle}
              </p>
            )}
          </div>
          <GameV2StatusPill status={status} />
        </div>
      </div>
    </motion.button>
  )
}
