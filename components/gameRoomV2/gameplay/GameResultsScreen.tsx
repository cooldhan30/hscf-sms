'use client'

import { motion } from 'framer-motion'
import { GameV2Card, GameV2Button, useGameV2Motion } from '@/components/gameRoomV2'
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

  return (
    <GameV2Card padding="lg" className="max-w-lg w-full mx-auto text-center">
      <motion.div
        initial={reduced ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={celebrate}
        className="text-6xl mb-2"
        aria-hidden
      >
        🏆
      </motion.div>
      <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Session Complete!</h2>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Stat value={result.score} label="Score" tone="text-gamev2ink-800 dark:text-white" />
        <Stat value={`${result.accuracyPct}%`} label="Accuracy" tone="text-gamev2mint-600 dark:text-gamev2mint-400" />
        <Stat value={result.correctCount} label="Correct" tone="text-gamev2mint-600 dark:text-gamev2mint-400" />
        <Stat value={result.incorrectCount} label="Incorrect" tone="text-gamev2coral-600 dark:text-gamev2coral-400" />
        <Stat value={result.bestStreak} label="Best Streak" tone="text-gamev2spark-600 dark:text-gamev2spark-400" />
        <Stat value={result.totalQuestions} label="Questions" tone="text-gamev2ink-800 dark:text-white" />
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gamev2ink-800 dark:bg-gamev2ink-700 text-white font-bold">
          <span aria-hidden>⭐</span> +{result.xpEarned} XP
        </div>
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gamev2spark-100 dark:bg-gamev2spark-500/20 text-gamev2spark-800 dark:text-gamev2spark-300 font-bold">
          <span aria-hidden>🪙</span> +{result.coinsEarned}
        </div>
      </div>

      {result.skillsPracticed.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2">
            Skills Practiced
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {result.skillsPracticed.map((skill) => (
              <span
                key={skill}
                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gamev2ink-100 dark:bg-gamev2ink-800 text-gamev2ink-600 dark:text-gamev2ink-300 font-tamil"
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
            Play Again
          </GameV2Button>
        )}
        {onExit && (
          <GameV2Button variant="ghost" fullWidth onClick={onExit}>
            Exit
          </GameV2Button>
        )}
      </div>
    </GameV2Card>
  )
}

function Stat({ value, label, tone }: { value: string | number; label: string; tone: string }) {
  return (
    <div>
      <p className={`text-2xl sm:text-3xl font-black tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mt-1">
        {label}
      </p>
    </div>
  )
}
