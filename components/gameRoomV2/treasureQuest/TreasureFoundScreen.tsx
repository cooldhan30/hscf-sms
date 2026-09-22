'use client'

import { motion } from 'framer-motion'
import { GameV2Card, GameV2Button, useGameV2Motion } from '@/components/gameRoomV2'

// The treasure-found celebration -- a staged reveal (chest -> burst ->
// treasure) rather than a flat label, plus a recap of every clue
// collected along the way so the exploration/narrative layer pays off
// visibly, not just the key-counting mechanic.
export function TreasureFoundScreen({ cluesFound, onContinue }: { cluesFound: string[]; onContinue: () => void }) {
  const { reduced, celebrate } = useGameV2Motion()

  return (
    <GameV2Card padding="lg" className="max-w-lg w-full mx-auto text-center overflow-hidden relative">
      {!reduced && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-gamev2spark-200/60 via-transparent to-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.2, times: [0, 0.3, 1] }}
        />
      )}

      <motion.div
        className="text-6xl mb-2 relative"
        initial={reduced ? { opacity: 0 } : { scale: 0.3, opacity: 0, rotate: -15 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={reduced ? { duration: 0 } : { ...celebrate }}
        aria-hidden
      >
        {'\u{1F4B0}'}
      </motion.div>

      <motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : { delay: 0.4 }}>
        <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Treasure Found!</h2>
        <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">You explored every locked door and reached the treasury.</p>

        {cluesFound.length > 0 && (
          <div className="mt-5 text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2 text-center">
              {'\u{1F4DC}'} Clues Uncovered
            </p>
            <ul className="space-y-1.5">
              {cluesFound.map((clue, i) => (
                <li key={i} className="text-sm text-gamev2ink-600 dark:text-gamev2ink-300 italic rounded-xl bg-gamev2ink-50 dark:bg-gamev2ink-800/50 p-2.5">
                  {clue}
                </li>
              ))}
            </ul>
          </div>
        )}

        <GameV2Button variant="spark" fullWidth className="mt-6" onClick={onContinue}>
          Continue
        </GameV2Button>
      </motion.div>
    </GameV2Card>
  )
}
