'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

// Level-complete screen -- distinct from InteractiveCompletionScreen
// (used by every single-round game) since a word-formation level has
// its own richer stats (words completed, accuracy, hints) and an
// explicit "next level" action, per spec's "Level Complete!" flow
// rather than a generic "Play Again".
export function WordFormationLevelCompleteScreen({
  level,
  wordsCompleted,
  totalWords,
  hintsUsed,
  unlockedNext,
  onReplayLevel,
  onNextLevel,
}: {
  level: number
  wordsCompleted: number
  totalWords: number
  hintsUsed: number
  unlockedNext: boolean
  onReplayLevel: () => void
  onNextLevel: () => void
}) {
  const router = useRouter()
  const accuracy = totalWords > 0 ? Math.round((wordsCompleted / totalWords) * 100) : 0

  return (
    <div className="flex items-center justify-center px-4 py-16">
      <div className="max-w-sm w-full text-center text-stone-700 dark:text-stone-200 space-y-4">
        <p className="text-3xl">🎉</p>
        <h1 className="text-xl font-bold">நிலை {level} முடிந்தது!</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">அருமையாக விளையாடினீர்கள்!</p>

        <div className="grid grid-cols-3 gap-2 py-2">
          <div>
            <p className="text-2xl font-black text-primary-700 dark:text-primary-400">{wordsCompleted}/{totalWords}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Words</p>
          </div>
          <div>
            <p className="text-2xl font-black text-primary-700 dark:text-primary-400">{accuracy}%</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Accuracy</p>
          </div>
          <div>
            <p className="text-2xl font-black text-primary-700 dark:text-primary-400">{hintsUsed}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Hints Used</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {unlockedNext && (
            <Button variant="primary" fullWidth onClick={onNextLevel}>
              அடுத்த நிலைக்கு செல்லுங்கள் →
            </Button>
          )}
          <Button variant="outline" fullWidth onClick={onReplayLevel}>
            மீண்டும் விளையாடு
          </Button>
          <Button variant="outline" fullWidth onClick={() => router.push('/student/game-room/word-formation')}>
            Back to Levels
          </Button>
        </div>
      </div>
    </div>
  )
}
