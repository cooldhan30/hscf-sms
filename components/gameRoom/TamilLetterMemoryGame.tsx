'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiStar } from 'react-icons/fi'
import { playSound } from '@/lib/gameRoom/sound'
import type { MemoryTile } from '@/lib/gameRoom/modules/tamilLetterGames/memoryGame'
import { InteractiveCompletionScreen } from './InteractiveCompletionScreen'

interface TamilLetterMemoryGameProps {
  sessionId: string
  tiles: MemoryTile[]
  pairCount: number
  instructions: string
  completionMessage: (attempts: number) => string
  onComplete: (sessionId: string, score: number) => Promise<void>
  onRestart: () => void
}

const MISMATCH_DELAY_MS = 700

// Memory/matching card-flip -- entirely client-side interaction (flip/
// match state never touches the server mid-game); only the final
// completion is reported once, via onComplete. Generic over `tiles`/
// `pairCount` so it backs both the Uyir (12 pairs / 24 cards) and Mei
// (18 pairs / 36 cards) Ezhuthukkal memory games from one implementation.
export function TamilLetterMemoryGame({
  sessionId,
  tiles,
  pairCount,
  instructions,
  completionMessage,
  onComplete,
  onRestart,
}: TamilLetterMemoryGameProps) {
  const [flipped, setFlipped] = useState<string[]>([])
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [mismatched, setMismatched] = useState<string[]>([])
  const [attempts, setAttempts] = useState(0)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(false)

  const matchedPairs = matched.size / 2

  function handleFlip(tile: MemoryTile) {
    if (busy || flipped.includes(tile.id) || matched.has(tile.id)) return

    const nextFlipped = [...flipped, tile.id]
    setFlipped(nextFlipped)

    if (nextFlipped.length < 2) return

    setBusy(true)
    setAttempts((a) => a + 1)

    const [firstId, secondId] = nextFlipped
    const first = tiles.find((t) => t.id === firstId)!
    const second = tiles.find((t) => t.id === secondId)!

    if (first.letter === second.letter) {
      playSound('correct')
      const newMatched = new Set(matched)
      newMatched.add(firstId)
      newMatched.add(secondId)
      setMatched(newMatched)
      setFlipped([])
      setBusy(false)

      if (newMatched.size === tiles.length) {
        playSound('complete')
        setCompleted(true)
        onComplete(sessionId, pairCount)
      }
    } else {
      playSound('incorrect')
      setMismatched([firstId, secondId])
      setTimeout(() => {
        setFlipped([])
        setMismatched([])
        setBusy(false)
      }, MISMATCH_DELAY_MS)
    }
  }

  if (completed) {
    return (
      <InteractiveCompletionScreen
        score={pairCount}
        maxScore={pairCount}
        message={completionMessage(attempts)}
        onPlayAgain={onRestart}
      />
    )
  }

  // 24 cards (Uyir): 4 cols mobile / 6 desktop. 36 cards (Mei): 4 cols
  // mobile / 6 desktop-and-tablet, same as the spec's requested 4x9 /
  // 6x6 responsive layout -- Tailwind's grid-cols wraps to the right row
  // count automatically from the tile count, no per-set branch needed.
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">{instructions}</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          {matchedPairs} / {pairCount}
        </p>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3">
        {tiles.map((tile) => {
          const isFaceUp = flipped.includes(tile.id) || matched.has(tile.id)
          const isMatched = matched.has(tile.id)
          const isMismatched = mismatched.includes(tile.id)

          return (
            <button
              key={tile.id}
              onClick={() => handleFlip(tile)}
              disabled={isMatched}
              className="aspect-square [perspective:600px]"
              aria-label={isFaceUp ? tile.letter : 'Hidden card'}
            >
              <motion.div
                animate={{
                  rotateY: isFaceUp ? 180 : 0,
                  scale: isMatched ? [1, 1.15, 1] : 1,
                  x: isMismatched ? [0, -6, 6, -6, 0] : 0,
                }}
                transition={{ duration: 0.35 }}
                className="relative w-full h-full [transform-style:preserve-3d]"
              >
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-xl bg-primary-700 dark:bg-primary-600 text-white [backface-visibility:hidden]"
                >
                  <FiStar className="w-6 h-6 opacity-70" />
                </div>
                <div
                  className={`absolute inset-0 flex items-center justify-center rounded-xl border-2 text-2xl sm:text-3xl font-black [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                    isMatched
                      ? 'border-primary-700 dark:border-primary-400 bg-primary-50 dark:bg-primary-950 text-primary-800 dark:text-primary-300'
                      : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100'
                  }`}
                >
                  {tile.letter}
                </div>
              </motion.div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
