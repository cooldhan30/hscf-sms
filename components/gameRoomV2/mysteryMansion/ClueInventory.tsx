'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'

// The clue inventory -- a small collapsible-feeling list of every clue
// collected so far. Kept deliberately simple (a plain list, no
// drag/sort/examine interaction) per the "avoid unnecessarily complex
// narrative engine" requirement -- its only job is to make collected
// progress visible and satisfying to look back on.
export function ClueInventory({ clues }: { clues: string[] }) {
  const { reduced } = useGameV2Motion()

  if (clues.length === 0) return null

  return (
    <div className="w-full max-w-xl mx-auto rounded-2xl bg-gamev2ink-50 dark:bg-gamev2ink-800/50 border border-gamev2ink-100 dark:border-gamev2ink-700 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2">
        {'\u{1F9E9}'} Clues collected ({clues.length})
      </p>
      <ul className="space-y-1.5" aria-label="Clues collected so far">
        <AnimatePresence initial={false}>
          {clues.map((clue, i) => (
            <motion.li
              key={i}
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduced ? { duration: 0.1 } : { type: 'spring', stiffness: 300, damping: 24 }}
              className="text-xs text-gamev2ink-600 dark:text-gamev2ink-300 italic"
            >
              {'•'} {clue}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}
