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
// recall game. Different from TamilLetterOrderGame (which arranges ALL
// tiles from scratch): here most positions are already filled in and
// only a subset of slots are empty, and the source pool shows the
// COMPLETE letter set (not just the missing ones) so the child must
// recognize the right letter among all of them, not just pick from an
// already-filtered short list. Entirely client-side until the single
// onComplete call, same as every other interactive game here.
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
    // The blanks are small (48-56px) worksheet-style cells, much
    // smaller than the drop zones in the other drag games -- an exact
    // "pointer inside this rect" containment test made it nearly
    // impossible for a child to land a drop, since releasing even a
    // few pixels outside the tiny box counted as a miss even when
    // aimed at the right blank. Padding the hit box (rather than
    // requiring pixel-perfect containment) makes the same blanks far
    // more forgiving to drop onto, matching how the other drag games
    // already feel.
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
      // Not dropped on an empty missing-slot -- ignore, no feedback (a
      // miss, not a wrong answer).
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

      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {sourceLetters.map((letter) => {
          const isUsed = usedLetters.has(letter)
          return (
            <motion.div
              key={letter}
              drag={!isUsed}
              dragSnapToOrigin
              dragElastic={0.2}
              whileDrag={{ scale: 1.15, zIndex: 10 }}
              onDragEnd={(_e, info) => handleDragEnd(letter, info.point.x, info.point.y)}
              animate={shake === letter ? { x: [0, -8, 8, -8, 0] } : {}}
              transition={{ duration: 0.3 }}
              className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-2xl border-2 text-2xl sm:text-3xl font-black select-none ${
                isUsed
                  ? 'opacity-30 pointer-events-none border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 text-stone-400 dark:text-stone-600'
                  : 'border-primary-700 dark:border-primary-400 bg-white dark:bg-stone-900 text-primary-800 dark:text-primary-300 cursor-grab active:cursor-grabbing shadow-md touch-none'
              }`}
            >
              {letter}
            </motion.div>
          )
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
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
