'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { playSound } from '@/lib/gameRoom/sound'
import { isMatchingPair, type Pair } from '@/lib/gameRoom/modules/tamilLetterGames/pairMatchGame'
import { InteractiveCompletionScreen } from './InteractiveCompletionScreen'

interface TamilPairMatchGameProps {
  sessionId: string
  leftCards: string[]
  rightCards: string[]
  pairs: readonly Pair[]
  instructions: string
  completionMessage: string
  onComplete: (sessionId: string, score: number) => Promise<void>
  onRestart: () => void
}

// Tap-a-left-card, then tap-a-right-card matching game -- a different
// shape from the memory game's flip-two-face-down-cards (both sides
// are visible from the start here, and left/right are two distinct,
// independently-shuffled sets rather than one shuffled deck), and from
// the sort game's drag-into-a-box (this is tap-to-select, no dragging).
// Generic over `pairs` so it can back any future two-column Tamil
// matching game, not just Ina Ezhuthukkal.
export function TamilPairMatchGame({
  sessionId,
  leftCards,
  rightCards,
  pairs,
  instructions,
  completionMessage,
  onComplete,
  onRestart,
}: TamilPairMatchGameProps) {
  const total = pairs.length

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  const [selectedRight, setSelectedRight] = useState<string | null>(null)
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [shakePair, setShakePair] = useState<{ left: string; right: string } | null>(null)
  const [celebratePair, setCelebratePair] = useState<{ left: string; right: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(false)

  const matchedCount = matched.size / 2

  function checkPair(left: string, right: string) {
    setBusy(true)
    if (isMatchingPair(pairs, left, right)) {
      playSound('correct')
      setCelebratePair({ left, right })
      setTimeout(() => setCelebratePair(null), 400)

      const newMatched = new Set(matched)
      newMatched.add(left)
      newMatched.add(right)
      setMatched(newMatched)
      setSelectedLeft(null)
      setSelectedRight(null)
      setBusy(false)

      if (newMatched.size === total * 2) {
        playSound('complete')
        setCompleted(true)
        onComplete(sessionId, total)
      }
    } else {
      playSound('incorrect')
      setShakePair({ left, right })
      setTimeout(() => {
        setShakePair(null)
        setSelectedLeft(null)
        setSelectedRight(null)
        setBusy(false)
      }, 500)
    }
  }

  function handleSelectLeft(card: string) {
    if (busy || matched.has(card)) return
    if (selectedLeft === card) {
      setSelectedLeft(null)
      return
    }
    setSelectedLeft(card)
    if (selectedRight) checkPair(card, selectedRight)
  }

  function handleSelectRight(card: string) {
    if (busy || matched.has(card)) return
    if (selectedRight === card) {
      setSelectedRight(null)
      return
    }
    setSelectedRight(card)
    if (selectedLeft) checkPair(selectedLeft, card)
  }

  if (completed) {
    return (
      <InteractiveCompletionScreen
        score={total}
        maxScore={total}
        message={completionMessage}
        onPlayAgain={onRestart}
      />
    )
  }

  function cardClass(card: string, side: 'left' | 'right') {
    const isMatched = matched.has(card)
    const isSelected = side === 'left' ? selectedLeft === card : selectedRight === card
    const isCelebrating = side === 'left' ? celebratePair?.left === card : celebratePair?.right === card
    const isShaking = side === 'left' ? shakePair?.left === card : shakePair?.right === card

    if (isMatched) {
      return {
        className:
          'border-primary-700 dark:border-primary-400 bg-primary-50 dark:bg-primary-950 text-primary-800 dark:text-primary-300 opacity-60 cursor-default',
        animate: isCelebrating ? { scale: [1, 1.15, 1] } : { scale: 1 },
      }
    }
    if (isSelected) {
      return {
        className:
          'border-amber-600 dark:border-amber-400 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300',
        animate: isShaking ? { x: [0, -8, 8, -8, 0] } : { scale: 1 },
      }
    }
    return {
      className:
        'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 cursor-pointer hover:border-primary-400',
      animate: isShaking ? { x: [0, -8, 8, -8, 0] } : { scale: 1 },
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">{instructions}</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          {matchedCount} / {total}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        <div className="space-y-3">
          {leftCards.map((card) => {
            const { className, animate } = cardClass(card, 'left')
            return (
              <motion.button
                key={card}
                onClick={() => handleSelectLeft(card)}
                disabled={matched.has(card)}
                animate={animate}
                transition={{ duration: 0.3 }}
                className={`w-full h-16 sm:h-20 flex items-center justify-center rounded-2xl border-2 text-2xl sm:text-3xl font-black select-none ${className}`}
              >
                {card}
              </motion.button>
            )
          })}
        </div>

        <div className="space-y-3">
          {rightCards.map((card) => {
            const { className, animate } = cardClass(card, 'right')
            return (
              <motion.button
                key={card}
                onClick={() => handleSelectRight(card)}
                disabled={matched.has(card)}
                animate={animate}
                transition={{ duration: 0.3 }}
                className={`w-full h-16 sm:h-20 flex items-center justify-center rounded-2xl border-2 text-2xl sm:text-3xl font-black select-none ${className}`}
              >
                {card}
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
