'use client'

import { motion } from 'framer-motion'
import { GameV2Card, GameV2Button, useGameV2Motion } from '@/components/gameRoomV2'
import type { BossDefinition } from '@/lib/gameRoomV2/bossBattle'

// The "visually dramatic victory" beat the spec asks for: a staged
// sequence (boss shatters -> burst -> trophy) rather than a plain
// "You Win" label. Every stage still respects prefers-reduced-motion --
// a reduced-motion viewer sees the same final state instantly instead
// of the staged build-up, never a broken half-animated frame.
export function VictorySequence({ boss, onContinue }: { boss: BossDefinition; onContinue: () => void }) {
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
        className="text-6xl mb-1 relative"
        initial={reduced ? { opacity: 0 } : { scale: 3, opacity: 0, rotate: -20 }}
        animate={reduced ? { opacity: 1 } : { scale: 1, opacity: [0, 1, 1], rotate: 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.6, ease: 'backOut' }}
        aria-hidden
      >
        {'\u{1F4A5}'}
      </motion.div>

      <motion.div
        className="text-6xl mb-2"
        initial={reduced ? { opacity: 0 } : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { ...celebrate, delay: 0.5 }}
        aria-hidden
      >
        {'\u{1F3C6}'}
      </motion.div>

      <motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : { delay: 0.8 }}>
        <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Victory!</h2>
        <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
          You defeated {boss.name} through every phase of the battle.
        </p>
        <GameV2Button variant="spark" fullWidth className="mt-6" onClick={onContinue}>
          Continue
        </GameV2Button>
      </motion.div>
    </GameV2Card>
  )
}
