'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { FiAward, FiStar } from 'react-icons/fi'
import { GameV2Card, GameV2Button, GameV2Badge, useGameV2Motion } from '@/components/gameRoomV2'
import { getAchievement } from '@/lib/gameRoomV2/progression/achievements'
import type { GameResult } from '@/lib/gameRoomV2/domain'
import { Bi } from '@/components/gameRoomV2/Bi'

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
  onHome,
  headline,
  subline,
  gameStats,
  details,
  hideLearningStats = false,
}: {
  result: GameResult
  onPlayAgain?: () => void
  // "Next activity": the results page with topic progress + Recommended Next.
  onExit?: () => void
  onHome?: () => void
  // Engine-specific outcome ("Fort defended!", "2nd place") and stats
  // (waves survived, enemies defeated...) shown above the learning stats.
  headline?: string
  subline?: string
  gameStats?: { label: string; value: string | number }[]
  // Engine-specific detail under the stats (e.g. which balloons were popped)
  details?: ReactNode
  // For games whose own stats already say it better (Balloon Pop's pop
  // rounds count pops, not questions): hides the Score/Accuracy/... grid
  hideLearningStats?: boolean
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
      <h2 className="font-tamil leading-snug text-2xl font-bold text-primary-900 dark:text-white">{headline ?? <Bi k="gameComplete" />}</h2>
      {subline && <p className="font-tamil text-sm text-stone-500 dark:text-stone-400 mt-1">{subline}</p>}

      {gameStats && gameStats.length > 0 && (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {gameStats.map((s) => (
            <div key={s.label} className="rounded-xl bg-stone-50 dark:bg-stone-800 px-3 py-2">
              <p className="text-lg font-bold text-stone-800 dark:text-stone-100 tabular-nums">{s.value}</p>
              <p className="font-tamil text-xs text-stone-500 dark:text-stone-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {details}

      <div className={`mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 ${hideLearningStats ? 'hidden' : ''}`}>
        <Stat value={result.score} label={<Bi k="score" />} tone="text-stone-800 dark:text-stone-100" />
        <Stat value={`${result.accuracyPct}%`} label={<Bi k="accuracy" />} tone="text-emerald-700 dark:text-emerald-400" />
        <Stat value={result.correctCount} label={<Bi k="correctAnswers" />} tone="text-emerald-700 dark:text-emerald-400" />
        <Stat value={result.incorrectCount} label={<Bi k="incorrect" />} tone="text-red-600 dark:text-red-400" />
        <Stat value={result.bestStreak} label={<Bi k="bestStreak" />} tone="text-gold-700 dark:text-gold-400" />
        <Stat value={result.totalQuestions} label={<Bi k="questions" />} tone="text-stone-800 dark:text-stone-100" />
      </div>

      {/* Wraps on narrow phones: the bilingual labels are long */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-full px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-950 text-primary-800 dark:text-primary-200 font-semibold">
          <FiStar className="w-4 h-4" aria-hidden /> +{result.xpEarned} <Bi k="xp" inline />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-full px-4 py-2 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-semibold">
          +{result.coinsEarned} <Bi k="coins" inline />
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
            <span className="font-tamil normal-case">புதிய சாதனை திறந்தது!</span> · Achievement unlocked
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
            <span className="font-tamil normal-case">பயிற்சி செய்த திறன்கள்</span> · Skills practised
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
            <Bi k="playAgain" inline />
          </GameV2Button>
        )}
        {onExit && (
          <GameV2Button variant="ghost" fullWidth onClick={onExit}>
            {onHome ? <Bi k="nextActivity" inline /> : <Bi k="seeProgress" inline />}
          </GameV2Button>
        )}
        {onHome && (
          <GameV2Button variant="ghost" fullWidth onClick={onHome}>
            <Bi k="backToGameRoom" inline />
          </GameV2Button>
        )}
      </div>
    </GameV2Card>
  )
}

function Stat({ value, label, tone }: { value: string | number; label: ReactNode; tone: string }) {
  return (
    <div>
      <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mt-1">
        {label}
      </p>
    </div>
  )
}
