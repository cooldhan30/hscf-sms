'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'
import type { LaneDefinition, ActiveWord } from '@/lib/gameRoomV2/wordNinja'

// The flight board: N category lanes across the top, flying words
// crossing the middle. Tapping a word opens its own inline lane
// picker (reliable across mouse/touch/tablet, no swipe-gesture library
// needed) -- "slash" here means "tap the word, then tap the lane it
// belongs to," which is the same two-step gesture regardless of
// whether the question has 2 categories or 5 (the reusable content
// model: this component never special-cases category count).
export function NinjaBoard({
  lanes,
  activeWords,
  selectedWordId,
  onSelectWord,
  onSlash,
}: {
  lanes: LaneDefinition[]
  activeWords: ActiveWord[]
  selectedWordId: string | null
  onSelectWord: (wordId: string | null) => void
  onSlash: (wordId: string, category: string) => void
}) {
  const { reduced } = useGameV2Motion()

  return (
    <div className="w-full rounded-3xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-gradient-to-b from-gamev2ink-50 to-gamev2ink-100 dark:from-gamev2ink-900 dark:to-gamev2ink-950 p-4 sm:p-6 overflow-hidden">
      <div className={`grid gap-2 mb-4`} style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}>
        {lanes.map((lane) => (
          <div
            key={lane.category}
            className="rounded-2xl border-2 border-dashed border-gamev2ink-300 dark:border-gamev2ink-700 bg-white/60 dark:bg-gamev2ink-900/60 py-2 px-1 text-center"
          >
            <span className="text-xs sm:text-sm font-bold font-tamil leading-relaxed text-gamev2ink-700 dark:text-gamev2ink-200">{lane.category}</span>
          </div>
        ))}
      </div>

      <div className="relative min-h-[9rem] sm:min-h-[10rem]">
        <AnimatePresence>
          {activeWords.map((word) => (
            <motion.button
              key={word.id}
              type="button"
              onClick={() => onSelectWord(selectedWordId === word.id ? null : word.id)}
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
              transition={reduced ? { duration: 0 } : { duration: 0.25 }}
              className={`relative mx-auto mb-3 block px-5 py-2.5 rounded-2xl font-tamil leading-relaxed font-extrabold text-lg sm:text-xl border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400 ${
                selectedWordId === word.id
                  ? 'border-gamev2spark-500 bg-gamev2spark-100 dark:bg-gamev2spark-500/20 text-gamev2ink-900 dark:text-white'
                  : word.missed
                    ? 'border-gamev2coral-400 bg-gamev2coral-50 dark:bg-gamev2coral-500/10 text-gamev2ink-800 dark:text-gamev2ink-100'
                    : 'border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-800 text-gamev2ink-800 dark:text-gamev2ink-100'
              }`}
            >
              {word.item}
              {word.missed && (
                <span className="absolute -top-2 -right-2 text-xs" aria-hidden>
                  {'⏱️'}
                </span>
              )}
            </motion.button>
          ))}
        </AnimatePresence>

        {activeWords.length === 0 && (
          <p className="text-center text-sm text-gamev2ink-400 dark:text-gamev2ink-500 py-8">Waiting for the next word...</p>
        )}
      </div>

      {selectedWordId && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}
        >
          {lanes.map((lane) => (
            <button
              key={lane.category}
              onClick={() => onSlash(selectedWordId, lane.category)}
              className="rounded-2xl bg-gamev2spark-500 hover:bg-gamev2spark-400 text-gamev2ink-950 font-bold font-tamil leading-relaxed text-xs sm:text-sm py-2.5 px-1 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-300"
            >
              {lane.category}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}
