'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiLock, FiCheckCircle, FiPlay } from 'react-icons/fi'
import { LEVEL_CONFIGS, levelPositionWithinComplexity } from '@/lib/gameRoom/modules/tamilWordFormation/levels'
import type { WordComplexity } from '@/lib/gameRoom/modules/tamilWordFormation/words'

const COMPLEXITY_LABELS: Record<WordComplexity, { tamil: string; english: string }> = {
  easy: { tamil: 'எளிது', english: 'Easy' },
  medium: { tamil: 'நடுத்தரம்', english: 'Medium' },
  hard: { tamil: 'கடினம்', english: 'Hard' },
}

// Complexity-select + level-grid landing page for சொல் உருவாக்குவோம் --
// per spec, this game needs its own navigation (complexity tabs, then
// a level grid with locked/unlocked state) that doesn't fit the
// existing "Practice on Your Own" single dropdown+button form, so it
// gets a dedicated page instead of squeezing into that form.
export function WordFormationHomeClient() {
  const router = useRouter()
  const [complexity, setComplexity] = useState<WordComplexity>('easy')
  const [highestUnlocked, setHighestUnlocked] = useState<Record<WordComplexity, number> | null>(null)

  useEffect(() => {
    fetch('/api/game-room/word-formation/progress')
      .then((res) => res.json())
      .then((data) => setHighestUnlocked(data.highestUnlocked ?? { easy: 1, medium: 1, hard: 1 }))
      .catch(() => setHighestUnlocked({ easy: 1, medium: 1, hard: 1 }))
  }, [])

  const levelsInTier = LEVEL_CONFIGS.filter((l) => l.complexity === complexity)
  const unlockedPosition = highestUnlocked?.[complexity] ?? 1

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">சொல் உருவாக்குவோம்!</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">எழுத்துகளை இணைத்து சொற்களை உருவாக்குங்கள்!</p>
      </div>

      <div className="flex gap-2 border-b border-stone-200 dark:border-stone-800">
        {(Object.keys(COMPLEXITY_LABELS) as WordComplexity[]).map((c) => (
          <button
            key={c}
            onClick={() => setComplexity(c)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              complexity === c
                ? 'border-primary-700 text-primary-800 dark:border-primary-400 dark:text-primary-300'
                : 'border-transparent text-stone-500 dark:text-stone-400'
            }`}
          >
            {COMPLEXITY_LABELS[c].tamil} · {COMPLEXITY_LABELS[c].english}
          </button>
        ))}
      </div>

      {highestUnlocked === null ? (
        <p className="text-sm text-stone-400 dark:text-stone-500">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {levelsInTier.map((levelConfig) => {
            const position = levelPositionWithinComplexity(levelConfig.level) ?? 1
            const isUnlocked = position <= unlockedPosition
            const isCompleted = position < unlockedPosition

            return (
              <button
                key={levelConfig.level}
                type="button"
                disabled={!isUnlocked}
                onClick={() => router.push(`/student/game-room/word-formation/${levelConfig.level}`)}
                className={`p-5 rounded-2xl border text-left space-y-2 transition-colors ${
                  isUnlocked
                    ? 'border-primary-200 dark:border-primary-900 bg-white dark:bg-stone-900 hover:border-primary-400 cursor-pointer'
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/40 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-stone-800 dark:text-stone-100">Level {position}</p>
                  {isCompleted ? (
                    <FiCheckCircle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  ) : isUnlocked ? (
                    <FiPlay className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  ) : (
                    <FiLock className="w-5 h-5 text-stone-400 dark:text-stone-600" />
                  )}
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {levelConfig.wordsPerLevel} words · {COMPLEXITY_LABELS[levelConfig.complexity].english}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
