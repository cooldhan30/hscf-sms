'use client'

import { motion } from 'framer-motion'
import { GameV2Card, GameV2Button, useGameV2Motion } from '@/components/gameRoomV2'
import type { CoopContribution } from '@/lib/gameRoomV2/bossBattle'

// The cooperative battle's final summary -- shown whether the class
// defeated the boss (victory) or the live session ended before that
// happened. The non-victory case is deliberately framed NEUTRALLY
// ("The battle ended" / "Great effort"), never as a loss, never
// blaming anyone -- there is no individual defeat state in cooperative
// Boss Battle at all (see coopBattle.ts's header comment), so this
// screen never says "you lost" or singles out low contributors.
export function CoopResultsScreen({
  victory,
  bossName,
  totalDamageDealt,
  bossMaxHealth,
  contributions,
  myParticipantId,
  onContinue,
}: {
  victory: boolean
  bossName: string
  totalDamageDealt: number
  bossMaxHealth: number
  contributions: CoopContribution[]
  myParticipantId: string | null
  onContinue: () => void
}) {
  const { reduced, celebrate } = useGameV2Motion()
  const progressPct = Math.min(100, Math.round((totalDamageDealt / bossMaxHealth) * 100))

  return (
    <GameV2Card padding="lg" className="max-w-lg w-full mx-auto text-center overflow-hidden relative">
      {victory && !reduced && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-gamev2spark-200/60 via-transparent to-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.2, times: [0, 0.3, 1] }}
        />
      )}

      <motion.div
        className="text-6xl mb-2 relative"
        initial={reduced ? { opacity: 0 } : { scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : celebrate}
        aria-hidden
      >
        {victory ? '\u{1F3C6}' : '\u{1F91D}'}
      </motion.div>

      <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">{victory ? 'Victory!' : 'Great Effort, Class!'}</h2>
      <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
        {victory
          ? `Together, the class defeated ${bossName}.`
          : `The class dealt ${progressPct}% of the damage needed to defeat ${bossName} -- every correct answer counted.`}
      </p>

      {contributions.length > 0 && (
        <div className="mt-5 text-left">
          <p className="text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2 text-center">Class Contributions</p>
          <ul className="space-y-1.5">
            {contributions.slice(0, 8).map((c, i) => (
              <li
                key={c.participantId}
                className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                  c.participantId === myParticipantId ? 'bg-gamev2spark-50 dark:bg-gamev2spark-500/10 border-2 border-gamev2spark-300 dark:border-gamev2spark-600' : 'bg-gamev2ink-50 dark:bg-gamev2ink-800/50'
                }`}
              >
                <span className="text-sm font-bold text-gamev2ink-800 dark:text-gamev2ink-100">
                  #{i + 1} {c.nickname}
                  {c.participantId === myParticipantId && <span className="text-[10px] text-gamev2spark-600 dark:text-gamev2spark-400"> (You)</span>}
                </span>
                <span className="text-sm font-bold text-gamev2spark-600 dark:text-gamev2spark-400 tabular-nums">{c.damageDealt} dmg</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <GameV2Button variant="spark" fullWidth className="mt-6" onClick={onContinue}>
        Continue
      </GameV2Button>
    </GameV2Card>
  )
}
