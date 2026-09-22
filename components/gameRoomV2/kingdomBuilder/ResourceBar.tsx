'use client'

import { motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'
import type { ResourceBundle } from '@/lib/gameRoomV2/kingdomBuilder'

const RESOURCE_DISPLAY: { key: keyof ResourceBundle; emoji: string; label: string }[] = [
  { key: 'coins', emoji: '\u{1FA99}', label: 'Coins' },
  { key: 'wood', emoji: '\u{1FAB5}', label: 'Wood' },
  { key: 'stone', emoji: '\u{1FAA8}', label: 'Stone' },
  { key: 'stars', emoji: '⭐', label: 'Stars' },
]

// The visible resource pool -- coins/wood/stone/stars, each a plain
// emoji + count, animated on change (skipped under reduced motion).
// role="group" + per-resource aria-label so a screen reader announces
// the running totals, not just the emoji glyphs.
export function ResourceBar({ resources }: { resources: ResourceBundle }) {
  const { reduced } = useGameV2Motion()

  return (
    <div className="w-full max-w-xl mx-auto flex items-center justify-center gap-3 sm:gap-4 flex-wrap" role="group" aria-label="Kingdom resources">
      {RESOURCE_DISPLAY.map(({ key, emoji, label }) => (
        <div
          key={key}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gamev2ink-50 dark:bg-gamev2ink-800/60 border border-gamev2ink-100 dark:border-gamev2ink-700"
          aria-label={`${label}: ${resources[key]}`}
        >
          <span aria-hidden>{emoji}</span>
          <motion.span
            key={resources[key]}
            initial={reduced ? { opacity: 1 } : { scale: 1.3, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 20 }}
            className="text-xs font-extrabold text-gamev2ink-800 dark:text-white tabular-nums"
          >
            {resources[key]}
          </motion.span>
        </div>
      ))}
    </div>
  )
}
