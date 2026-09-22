'use client'

import { motion } from 'framer-motion'
import { GameV2Card, GameV2Button, useGameV2Motion } from '@/components/gameRoomV2'
import { BUILD_ORDER } from '@/lib/gameRoomV2/kingdomBuilder'

// The kingdom-complete celebration -- a staged reveal of the finished
// castle plus a recap of everything built along the way, mirroring
// Treasure Quest's TreasureFoundScreen / Space Mission's
// MissionCompleteScreen precedent but with its own visual identity (a
// full settlement recap, not a single reveal).
export function KingdomCompleteScreen({ bestStreak, onContinue }: { bestStreak: number; onContinue: () => void }) {
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
        initial={reduced ? { opacity: 0 } : { scale: 0.3, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={reduced ? { duration: 0 } : { ...celebrate }}
        aria-hidden
      >
        {'\u{1F3F0}'}
      </motion.div>

      <motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : { delay: 0.4 }}>
        <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Your Kingdom Is Complete!</h2>
        <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
          Every building stands -- from the first house to the castle at its heart.
        </p>

        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap" aria-hidden>
          {BUILD_ORDER.map((b) => (
            <span key={b.id} className="text-2xl">
              {b.emoji}
            </span>
          ))}
        </div>

        {bestStreak > 1 && (
          <p className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-gamev2spark-100 dark:bg-gamev2spark-500/20 text-gamev2spark-700 dark:text-gamev2spark-300">
            {'\u{1F525}'} Best streak: {bestStreak}
          </p>
        )}

        <GameV2Button variant="spark" fullWidth className="mt-6" onClick={onContinue}>
          Continue
        </GameV2Button>
      </motion.div>
    </GameV2Card>
  )
}
