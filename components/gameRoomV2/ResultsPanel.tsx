'use client'

import { motion } from 'framer-motion'
import { FiAward } from 'react-icons/fi'
import { GameV2Card } from './GameV2Card'
import { GameV2Button } from './GameV2Button'
import { useGameV2Motion } from './useGameV2Motion'

// The end-of-session summary screen. `rank` is optional -- a solo
// practice run has no rank to show, same "not everything has a rank"
// distinction legacy GameRoom's own results screen already makes.
export function ResultsPanel({
  score,
  correctCount,
  totalQuestions,
  rank,
  onPlayAgain,
  onExit,
}: {
  score: number
  correctCount: number
  totalQuestions: number
  rank?: number | null
  onPlayAgain?: () => void
  onExit?: () => void
}) {
  const { celebrate, reduced } = useGameV2Motion()
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

  return (
    <GameV2Card padding="lg" className="max-w-md w-full mx-auto text-center">
      <motion.div
        initial={reduced ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={celebrate}
        className="mx-auto mb-3 w-14 h-14 rounded-full bg-gold-50 dark:bg-gold-900/30 text-gold-700 dark:text-gold-300 flex items-center justify-center"
        aria-hidden
      >
        <FiAward className="w-7 h-7" />
      </motion.div>
      <h2 className="text-2xl font-bold text-primary-900 dark:text-white"><span className="font-tamil">விளையாட்டு முடிந்தது!</span></h2>

      <div className="mt-6 flex items-center justify-center gap-8">
        <div>
          <p className="text-4xl font-bold text-stone-800 dark:text-white tabular-nums">{score}</p>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400 dark:text-stone-500 mt-1">
            Score
          </p>
        </div>
        <div>
          <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{accuracy}%</p>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400 dark:text-stone-500 mt-1">
            Accuracy
          </p>
        </div>
        {rank != null && (
          <div>
            <p className="text-4xl font-bold text-primary-600 dark:text-primary-400 tabular-nums">#{rank}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400 dark:text-stone-500 mt-1">
              Rank
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
        {correctCount} of {totalQuestions} correct
      </p>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
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
