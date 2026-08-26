'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiStar } from 'react-icons/fi'
import { playSound } from '@/lib/gameRoom/sound'
import type { MemoryTile } from '@/lib/gameRoom/modules/uyirEzhuthukkal/memoryGame'
import { InteractiveCompletionScreen } from './InteractiveCompletionScreen'

interface UyirMemoryGameProps {
  sessionId: string
  tiles: MemoryTile[]
  instructions: string
  onComplete: (sessionId: string, score: number) => Promise<void>
  onRestart: () => void
}

const MISMATCH_DELAY_MS = 700

// Memory/matching card-flip -- entirely client-side interaction (flip/
// match state never touches the server mid-game); only the final
// completion is reported once, via onComplete.
export function UyirMemoryGame({ sessionId, tiles, instructions, onComplete, onRestart }: UyirMemoryGameProps) {
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
        onComplete(sessionId, 12)
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
        score={12}
        maxScore={12}
        message={`12 உயிரெழுத்துகளையும் கண்டுபிடித்துவிட்டீர்கள்! (${attempts} attempts)`}
        onPlayAgain={onRestart}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">{instructions}</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">{matchedPairs} / 12</p>
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
