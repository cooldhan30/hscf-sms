'use client'

import { motion } from 'framer-motion'
import { FiAward, FiStar } from 'react-icons/fi'
import { GameV2Card, GameV2Button, GameV2Badge, useGameV2Motion } from '@/components/gameRoomV2'
import { getAchievement } from '@/lib/gameRoomV2/progression/achievements'
import type { GameResult } from '@/lib/gameRoomV2/domain'

// The full Results screen per the spec: Score, Accuracy, Correct,
// Incorrect, XP earned, Coins earned, Streak, Skills practiced. Every
// number here comes straight from the server's
// sessions/[id]/complete response (see the GameResult shape) -- this
// component never recomputes or trusts a client-side tally, since the
// whole point of server-side scoring is that the number shown here is
// the number that actually got persisted.
export function GameResultsScreen({
  result,
  onPlayAgain,
  onExit,
}: {
  result: GameResult
  onPlayAgain?: () => void
  onExit?: () => void
}) {
  const { celebrate, reduced } = useGameV2Motion()
  const newAchievements = (result.newlyEarnedAchievementIds ?? [])
    .map((id) => getAchievement(id))
    .filter((a): a is NonNullable<typeof a> => a !== undefined)

  return (
    <GameV2Card padding="lg" className="max-w-lg w-full mx-auto text-center">
      <motion.div
        initial={reduced ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={celebrate}
        className="mx-auto mb-3 w-14 h-14 rounded-full bg-gold-50 dark:bg-gold-900/30 text-gold-700 dark:text-gold-300 flex items-center justify-center"
        aria-hidden
      >
        <FiAward className="w-7 h-7" />
      </motion.div>
      <h2 className="text-2xl font-bold text-primary-900 dark:text-white">Game complete</h2>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Stat value={result.score} label="Score" tone="text-stone-800 dark:text-stone-100" />
        <Stat value={`${result.accuracyPct}%`} label="Accuracy" tone="text-emerald-700 dark:text-emerald-400" />
        <Stat value={result.correctCount} label="Correct" tone="text-emerald-700 dark:text-emerald-400" />
        <Stat value={result.incorrectCount} label="Incorrect" tone="text-red-600 dark:text-red-400" />
        <Stat value={result.bestStreak} label="Best Streak" tone="text-gold-700 dark:text-gold-400" />
        <Stat value={result.totalQuestions} label="Questions" tone="text-stone-800 dark:text-stone-100" />
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-950 text-primary-800 dark:text-primary-200 font-semibold">
          <FiStar className="w-4 h-4" aria-hidden /> +{result.xpEarned} XP
        </div>
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-semibold">
          +{result.coinsEarned} coins
        </div>
      </div>

      {newAchievements.length > 0 && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={celebrate}
          className="mt-6"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-700 dark:text-gold-400 mb-2">
            Achievement Unlocked!
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {newAchievements.map((a) => (
              <GameV2Badge key={a.id} icon={a.icon} label={a.name} />
            ))}
          </div>
        </motion.div>
      )}

      {result.skillsPracticed.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-2">
            Skills Practiced
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {result.skillsPracticed.map((skill) => (
              <span
                key={skill}
                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-tamil leading-relaxed"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        {onPlayAgain && (
          <GameV2Button variant="spark" fullWidth onClick={onPlayAgain}>
            Play again
          </GameV2Button>
        )}
        {onExit && (
          <GameV2Button variant="ghost" fullWidth onClick={onExit}>
            See my progress
          </GameV2Button>
        )}
      </div>
    </GameV2Card>
  )
}

function Stat({ value, label, tone }: { value: string | number; label: string; tone: string }) {
  return (
    <div>
      <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mt-1">
        {label}
      </p>
    </div>
  )
}
