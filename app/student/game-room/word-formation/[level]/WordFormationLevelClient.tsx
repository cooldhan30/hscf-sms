'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TamilWordFormationGame } from '@/components/gameRoom/TamilWordFormationGame'
import { WordFormationLevelCompleteScreen } from '@/components/gameRoom/WordFormationLevelCompleteScreen'
import type { WordPuzzle } from '@/lib/gameRoom/modules/tamilWordFormation/puzzle'
import { getLevelConfig, MAX_LEVEL } from '@/lib/gameRoom/modules/tamilWordFormation/levels'

interface CompletionResult {
  wordsCompleted: number
  hintsUsed: number
  unlockedNext: boolean
}

// Owns the level's lifecycle: fetch a fresh (unlock-checked, shuffled)
// puzzle set on mount/replay via /word-formation/start, render the
// play component, and report completion via /word-formation/complete
// once all words are done. Mirrors the sessionStorage-free, no-
// mid-play-persistence pattern every other interactive game here
// uses -- board state lives entirely in this component/its child until
// the single terminal call.
export function WordFormationLevelClient({ level }: { level: number }) {
  const router = useRouter()
  const [puzzles, setPuzzles] = useState<WordPuzzle[] | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [completion, setCompletion] = useState<CompletionResult | null>(null)
  const [instanceKey, setInstanceKey] = useState(0)

  const config = getLevelConfig(level)

  useEffect(() => {
    startLevel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceKey])

  async function startLevel() {
    setPuzzles(undefined)
    setError(null)
    setCompletion(null)

    const res = await fetch('/api/game-room/word-formation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Failed to start level')
      setPuzzles(null)
      return
    }

    setPuzzles(data.puzzleData.puzzles)
  }

  async function handleLevelComplete(wordsCompleted: number, hintsUsed: number) {
    const res = await fetch('/api/game-room/word-formation/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, wordsCompleted, hintsUsed }),
    })
    const data = await res.json().catch(() => ({}))
    setCompletion({
      wordsCompleted,
      hintsUsed,
      unlockedNext: res.ok ? Boolean(data.unlockedNext) : false,
    })
  }

  if (!config) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-stone-500 dark:text-stone-400">Unknown level.</p>
      </div>
    )
  }

  if (completion) {
    return (
      <WordFormationLevelCompleteScreen
        level={level}
        wordsCompleted={completion.wordsCompleted}
        totalWords={config.wordsPerLevel}
        hintsUsed={completion.hintsUsed}
        unlockedNext={completion.unlockedNext}
        onReplayLevel={() => setInstanceKey((k) => k + 1)}
        onNextLevel={() => {
          const nextLevel = Math.min(level + 1, MAX_LEVEL)
          router.push(`/student/game-room/word-formation/${nextLevel}`)
        }}
      />
    )
  }

  if (puzzles === undefined) {
    return <p className="text-center py-16 text-stone-400 dark:text-stone-500">Loading level...</p>
  }

  if (!puzzles) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-stone-500 dark:text-stone-400">{error || 'This level could not be started.'}</p>
      </div>
    )
  }

  return <TamilWordFormationGame key={instanceKey} level={level} puzzles={puzzles} onLevelComplete={handleLevelComplete} />
}
