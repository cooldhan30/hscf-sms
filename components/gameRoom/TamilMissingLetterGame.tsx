'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { playSound } from '@/lib/gameRoom/sound'
import type { SequenceSlot } from '@/lib/gameRoom/modules/missingLetterGames/missingLetterGame'
import { InteractiveCompletionScreen } from './InteractiveCompletionScreen'

interface TamilMissingLetterGameProps {
  sessionId: string
  sequence: SequenceSlot[]
  sourceLetters: string[]
  instructions: string
  completionMessage: string
  onComplete: (sessionId: string, score: number) => Promise<void>
  onRestart: () => void
}

// Drag-the-missing-letter-into-its-blank -- a worksheet-style sequence-
// recall game, using the same drag pattern as TamilLetterOrderGame
// (padded hit-test + a fixed-position source pool that never reflows,
// see that component's comments for why reflow broke drag reliability
// elsewhere). The source pool here was already rendered at a fixed
// position (sourceLetters never shrinks -- placed letters are just
// disabled in place), so it didn't have the reflow bug and can safely
// use drag-and-drop, matching every other letter game on this platform
// instead of the tap-to-select fallback tried earlier.
export function TamilMissingLetterGame({
  sessionId,
  sequence,
  sourceLetters,
  instructions,
  completionMessage,
  onComplete,
  onRestart,
}: TamilMissingLetterGameProps) {
  const missingCount = sequence.filter((s) => s.missing).length

  // `filled[i]` is the letter placed at slot i (only meaningful for
  // missing slots), null while still empty.
  const [filled, setFilled] = useState<(string | null)[]>(() => sequence.map(() => null))
  const [usedLetters, setUsedLetters] = useState<Set<string>>(new Set())
  const [shake, setShake] = useState<string | null>(null)
  const [celebrateSlot, setCelebrateSlot] = useState<number | null>(null)
  const [completed, setCompleted] = useState(false)
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])

  const correctCount = filled.filter((f) => f !== null).length

  function handleDragEnd(letter: string, pointerX: number, pointerY: number) {
    // Padded rather than exact containment -- an imprecise pointing
    // device (trackpad especially) makes landing inside a small exact
    // box unreliable even when visually "close enough."
    const HIT_PADDING_PX = 24
    const slotIndex = slotRefs.current.findIndex((el) => {
      if (!el) return false
      const rect = el.getBoundingClientRect()
      return (
        pointerX >= rect.left - HIT_PADDING_PX &&
        pointerX <= rect.right + HIT_PADDING_PX &&
        pointerY >= rect.top - HIT_PADDING_PX &&
        pointerY <= rect.bottom + HIT_PADDING_PX
      )
    })

    if (slotIndex === -1 || !sequence[slotIndex].missing || filled[slotIndex] !== null) {
      // Dropped outside any blank, or the blank is already filled --
      // stays in the pool, no feedback needed (this isn't a wrong
      // answer, just a miss).
      return
    }

    if (sequence[slotIndex].letter === letter) {
      playSound('correct')
      setFilled((prev) => {
        const next = [...prev]
        next[slotIndex] = letter
        return next
      })
      setUsedLetters((prev) => new Set(prev).add(letter))
      setCelebrateSlot(slotIndex)
      setTimeout(() => setCelebrateSlot(null), 400)

      if (correctCount + 1 === missingCount) {
        playSound('complete')
        setCompleted(true)
        onComplete(sessionId, missingCount)
      }
    } else {
      // Incorrect -- gentle shake feedback; dragSnapToOrigin returns
      // the tile to its pool position automatically.
      playSound('incorrect')
      setShake(letter)
      setTimeout(() => setShake(null), 400)
    }
  }

  if (completed) {
    return (
      <InteractiveCompletionScreen
        score={missingCount}
        maxScore={missingCount}
        message={completionMessage}
        onPlayAgain={onRestart}
      />
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">{instructions}</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          {correctCount} / {missingCount}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {sourceLetters.map((letter, tileIndex) => {
          const isUsed = usedLetters.has(letter)
          return (
            <motion.div
              key={`${letter}-${tileIndex}`}
              drag={!isUsed}
              dragSnapToOrigin
              dragElastic={0.2}
              whileDrag={{ scale: 1.15, zIndex: 10 }}
              onDragEnd={(_e, info) => handleDragEnd(letter, info.point.x, info.point.y)}
              animate={shake === letter ? { x: [0, -8, 8, -8, 0] } : {}}
              transition={{ duration: 0.3 }}
              className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-2xl border-2 text-2xl sm:text-3xl font-black select-none ${
                isUsed
                  ? 'opacity-0 pointer-events-none border-transparent'
                  : 'border-primary-700 dark:border-primary-400 bg-white dark:bg-stone-900 text-primary-800 dark:text-primary-300 cursor-grab active:cursor-grabbing shadow-md touch-none'
              }`}
            >
              {letter}
            </motion.div>
          )
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {sequence.map((slot, i) => (
          <motion.div
            key={i}
            ref={(el) => {
              slotRefs.current[i] = el
            }}
            animate={celebrateSlot === i ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: 0.4 }}
            className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-xl text-xl sm:text-2xl font-black ${
              !slot.missing
                ? 'text-stone-700 dark:text-stone-200'
                : filled[i]
                  ? 'border-2 border-primary-700 dark:border-primary-400 bg-primary-50 dark:bg-primary-950 text-primary-800 dark:text-primary-300'
                  : 'border-2 border-dashed border-stone-300 dark:border-stone-700 text-stone-300 dark:text-stone-700'
            }`}
          >
            {!slot.missing ? slot.letter : (filled[i] ?? '')}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
