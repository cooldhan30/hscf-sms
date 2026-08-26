'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

// Mirrors the visual language of PlayGameClient.tsx's own completion
// screens (quiz engine) so both game types feel like the same platform,
// with a "Play Again" action that's meaningless for a competitive class
// quiz but natural for a solo practice game.
export function InteractiveCompletionScreen({
  score,
  maxScore,
  message,
  onPlayAgain,
}: {
  score: number
  maxScore: number
  message: string
  onPlayAgain: () => void
}) {
  const router = useRouter()

  return (
    <div className="flex items-center justify-center px-4 py-16">
      <div className="max-w-sm w-full text-center text-stone-700 dark:text-stone-200 space-y-4">
        <p className="text-3xl">🎉</p>
        <h1 className="text-xl font-bold">மிகவும் அருமை!</h1>
        <div className="space-y-1">
          <p className="text-4xl font-black text-primary-700 dark:text-primary-400">
            {score} / {maxScore}
          </p>
        </div>
        <p className="text-sm text-stone-500 dark:text-stone-400">{message}</p>
        <div className="flex gap-2 justify-center pt-2">
          <Button variant="primary" onClick={onPlayAgain}>
            மீண்டும் விளையாடு
          </Button>
          <Button variant="outline" onClick={() => router.push('/student/game-room')}>
            Back to Game Room
          </Button>
        </div>
      </div>
    </div>
  )
}
