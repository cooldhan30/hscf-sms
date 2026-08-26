'use client'

import { useState } from 'react'
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

// Tap-a-letter-then-tap-a-blank missing-letter game -- a worksheet-
// style sequence-recall activity. Originally built as drag-and-drop,
// but coordinate-based drop detection (pointer position vs. blank
// bounding rects, then elementFromPoint, then continuous hover
// tracking) proved unreliable across input devices (confirmed broken
// on a trackpad even after three different hit-testing approaches).
// Switched to the same tap-to-select pattern already proven in
// TamilPairMatchGame -- select a source letter, then select the blank
// it belongs in -- which sidesteps drag physics/coordinate timing
// entirely and is also more accessible (keyboard/switch-friendly,
// unlike a drag gesture).
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
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [shakeSlot, setShakeSlot] = useState<number | null>(null)
  const [celebrateSlot, setCelebrateSlot] = useState<number | null>(null)
  const [completed, setCompleted] = useState(false)

  const correctCount = filled.filter((f) => f !== null).length

  function handleSelectLetter(letter: string) {
    if (usedLetters.has(letter)) return
    setSelectedLetter((prev) => (prev === letter ? null : letter))
  }

  function handleSelectSlot(slotIndex: number) {
    if (!sequence[slotIndex].missing || filled[slotIndex] !== null) return
    if (!selectedLetter) return

    const letter = selectedLetter

    if (sequence[slotIndex].letter === letter) {
      playSound('correct')
      setFilled((prev) => {
        const next = [...prev]
        next[slotIndex] = letter
        return next
      })
      setUsedLetters((prev) => new Set(prev).add(letter))
      setSelectedLetter(null)
      setCelebrateSlot(slotIndex)
      setTimeout(() => setCelebrateSlot(null), 400)

      if (correctCount + 1 === missingCount) {
        playSound('complete')
        setCompleted(true)
        onComplete(sessionId, missingCount)
      }
    } else {
      playSound('incorrect')
      setShakeSlot(slotIndex)
      setSelectedLetter(null)
      setTimeout(() => setShakeSlot(null), 400)
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
          const isSelected = selectedLetter === letter
          return (
            <button
              key={letter}
              type="button"
              onClick={() => handleSelectLetter(letter)}
              disabled={isUsed}
              className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-2xl border-2 text-2xl sm:text-3xl font-black select-none transition-transform ${
                isUsed
                  ? 'opacity-30 border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 text-stone-400 dark:text-stone-600'
                  : isSelected
                    ? 'scale-110 border-amber-600 dark:border-amber-400 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 shadow-lg'
                    : 'border-primary-700 dark:border-primary-400 bg-white dark:bg-stone-900 text-primary-800 dark:text-primary-300 shadow-md hover:scale-105'
              }`}
            >
              {letter}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {sequence.map((slot, i) => (
          <motion.button
            key={i}
            type="button"
            onClick={() => handleSelectSlot(i)}
            disabled={!slot.missing || filled[i] !== null}
            animate={
              celebrateSlot === i
                ? { scale: [1, 1.25, 1] }
                : shakeSlot === i
                  ? { x: [0, -8, 8, -8, 0] }
                  : { scale: 1 }
            }
            transition={{ duration: 0.4 }}
            className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-xl text-xl sm:text-2xl font-black ${
              !slot.missing
                ? 'text-stone-700 dark:text-stone-200'
                : filled[i]
                  ? 'border-2 border-primary-700 dark:border-primary-400 bg-primary-50 dark:bg-primary-950 text-primary-800 dark:text-primary-300'
                  : selectedLetter
                    ? 'border-2 border-dashed border-amber-500 dark:border-amber-400 text-stone-300 dark:text-stone-700 cursor-pointer'
                    : 'border-2 border-dashed border-stone-300 dark:border-stone-700 text-stone-300 dark:text-stone-700'
            }`}
          >
            {!slot.missing ? slot.letter : (filled[i] ?? '')}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
