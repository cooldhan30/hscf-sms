'use client'

import { motion } from 'framer-motion'
import { GameV2Card, GameV2Button, useGameV2Motion } from '@/components/gameRoomV2'
import { buildResolutionText, type GeneratedMystery } from '@/lib/gameRoomV2/mysteryMansion'

// The mystery's satisfying reveal -- a staged unveiling of the missing
// item plus the plain-language resolution (who had it, and where it
// turned up), mirroring Treasure Quest's TreasureFoundScreen / Space
// Mission's MissionCompleteScreen / Kingdom Builder's
// KingdomCompleteScreen precedent, with its own identity: a
// "case closed" detective framing rather than a treasure/mission/
// kingdom framing. Every generated mystery (see generator.ts) resolves
// harmlessly -- nothing was ever truly stolen, only misplaced --
// keeping the tone adventurous and friendly, never accusatory.
export function MysteryResolvedScreen({ mystery, bestStreak, onContinue }: { mystery: GeneratedMystery; bestStreak: number; onContinue: () => void }) {
  const { reduced, celebrate } = useGameV2Motion()
  const resolution = buildResolutionText(mystery)

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
        initial={reduced ? { opacity: 0 } : { scale: 0.3, opacity: 0, rotate: 12 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={reduced ? { duration: 0 } : { ...celebrate }}
        aria-hidden
      >
        {mystery.template.missingItemEmoji}
      </motion.div>

      <motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : { delay: 0.4 }}>
        <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Case Closed!</h2>
        <p className="mt-2 text-sm text-gamev2ink-600 dark:text-gamev2ink-300 max-w-sm mx-auto">{resolution}</p>

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
