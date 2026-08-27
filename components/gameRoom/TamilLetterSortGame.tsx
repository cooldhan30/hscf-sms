'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { playSound } from '@/lib/gameRoom/sound'
import type { Classifiable } from '@/lib/gameRoom/modules/tamilLetterGames/classifySortGame'
import { classifyLetter } from '@/lib/gameRoom/modules/tamilLetterGames/classifySortGame'
import { InteractiveCompletionScreen } from './InteractiveCompletionScreen'

export interface SortCategory {
  id: string
  label: string
  borderClass: string
  bgClass: string
  textClass: string
}

interface TamilLetterSortGameProps {
  sessionId: string
  tiles: string[]
  items: readonly Classifiable[]
  categories: SortCategory[]
  instructions: string
  completionMessage: string
  onComplete: (sessionId: string, score: number) => Promise<void>
  onRestart: () => void
}

// Generic drag-into-N-category-boxes classification game -- backs both
// the 2-box Kuril/Nedil sort and the 3-box Vallinam/Mellinam/Idaiyinam
// sort (and any future classification game) from one implementation.
// A different shape from TamilLetterOrderGame's ordered slots: here a
// letter is correct in exactly one of several boxes based on its
// `type`, not one fixed index. Entirely client-side until the single
// onComplete call, same as every other interactive game here.
export function TamilLetterSortGame({
  sessionId,
  tiles,
  items,
  categories,
  instructions,
  completionMessage,
  onComplete,
  onRestart,
}: TamilLetterSortGameProps) {
  const total = items.length

  // Every tile stays rendered at a fixed tray position for the whole
  // round (never removed/reflowed) -- placed letters just become
  // invisible/disabled in place. Reflowing the tray after each correct
  // drop was found to desync framer-motion's drag gesture from a
  // tile's actual screen position for whichever tile got dragged next,
  // making drops fail unpredictably partway through a round.
  const [usedLetters, setUsedLetters] = useState<Set<string>>(new Set())
  const [boxes, setBoxes] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, []]))
  )
  const [shake, setShake] = useState<string | null>(null)
  const [celebrateBox, setCelebrateBox] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const boxRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const correctCount = Object.values(boxes).reduce((sum, arr) => sum + arr.length, 0)

  function handleDragEnd(letter: string, pointerX: number, pointerY: number) {
    // Padded rather than exact containment -- an imprecise pointing
    // device (trackpad especially) makes landing inside a box edge
    // unreliable even when visually "close enough."
    const HIT_PADDING_PX = 24
    const target = categories.find((c) => {
      const el = boxRefs.current[c.id]
      if (!el) return false
      const rect = el.getBoundingClientRect()
      return (
        pointerX >= rect.left - HIT_PADDING_PX &&
        pointerX <= rect.right + HIT_PADDING_PX &&
        pointerY >= rect.top - HIT_PADDING_PX &&
        pointerY <= rect.bottom + HIT_PADDING_PX
      )
    })

    if (!target) return

    const actual = classifyLetter(items, letter)
    if (actual === target.id) {
      playSound('correct')
      setUsedLetters((prev) => new Set(prev).add(letter))
      setBoxes((prev) => ({ ...prev, [target.id]: [...prev[target.id], letter] }))
      setCelebrateBox(target.id)
      setTimeout(() => setCelebrateBox(null), 400)

      if (correctCount + 1 === total) {
        playSound('complete')
        setCompleted(true)
        onComplete(sessionId, total)
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
        score={total}
        maxScore={total}
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
          {correctCount} / {total}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4 sm:gap-5 min-h-[5rem]">
        {tiles.map((letter, tileIndex) => {
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
              className={`w-16 h-16 flex items-center justify-center rounded-2xl border-2 text-3xl font-black select-none ${
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

      <div className="flex flex-col sm:flex-row gap-4">
        {categories.map((category) => (
          <motion.div
            key={category.id}
            ref={(el) => {
              boxRefs.current[category.id] = el
            }}
            animate={celebrateBox === category.id ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={{ duration: 0.4 }}
            className={`flex-1 min-h-[8rem] rounded-2xl border-4 border-dashed ${category.borderClass} ${category.bgClass} p-4 flex flex-col items-center gap-3`}
          >
            <p className={`text-2xl font-black ${category.textClass}`}>{category.label}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {boxes[category.id].map((letter) => (
                <span
                  key={letter}
                  className={`w-12 h-12 flex items-center justify-center rounded-xl bg-white dark:bg-stone-900 border-2 ${category.borderClass} text-xl font-black ${category.textClass}`}
                >
                  {letter}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
