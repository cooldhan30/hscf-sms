'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { playSound } from '@/lib/gameRoom/sound'
import { InteractiveCompletionScreen } from './InteractiveCompletionScreen'

interface TamilLetterOrderGameProps {
  sessionId: string
  tiles: string[]
  // The canonical answer order -- a tile is correct in a slot iff it
  // matches this array at that index. Passed in (rather than imported
  // directly) so this one component serves every Tamil letter set
  // (Uyir Ezhuthukkal, Mei Ezhuthukkal, and any future set).
  letters: readonly string[]
  instructions: string
  completionMessage: string
  onComplete: (sessionId: string, score: number) => Promise<void>
  onRestart: () => void
}

// Drag-and-drop "arrange in order" -- entirely client-side interaction
// (tile positions never touch the server mid-game); only the final
// completion is reported once, via onComplete. Uses framer-motion's
// native `drag` prop (already a dependency, already used elsewhere in
// this app for enter/exit animation -- e.g. components/dashboard/
// Modal.tsx) for pointer/touch/mouse drag physics, rather than adding a
// new drag-and-drop library. Generic over `letters` so it backs both
// the Uyir and Mei Ezhuthukkal order games (and any future letter set)
// from one implementation.
export function TamilLetterOrderGame({
  sessionId,
  tiles,
  letters,
  instructions,
  completionMessage,
  onComplete,
  onRestart,
}: TamilLetterOrderGameProps) {
  const total = letters.length

  // `null` = still available in the tray, a letter = locked into that
  // slot index. A locked tile is correct by construction -- an incorrect
  // drop never locks in, it just snaps back to the tray.
  const [placed, setPlaced] = useState<(string | null)[]>(() => Array(total).fill(null))
  // The tray always renders every tile at a fixed position (never
  // removes/reflows an entry) -- placed letters just become invisible/
  // disabled in place. Reflowing the flex-wrap layout mid-game (e.g. by
  // filtering the array down after each correct drop) was found to
  // desync framer-motion's drag gesture from the tile's actual screen
  // position for whichever tile the child dragged next, making drops
  // fail unpredictably a few placements in -- keeping tile count and
  // position stable for the whole round avoids that entirely.
  const [usedLetters, setUsedLetters] = useState<Set<string>>(new Set())
  const [shake, setShake] = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState<number | null>(null)
  const [completed, setCompleted] = useState(false)
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])

  const correctCount = placed.filter((p) => p !== null).length

  function handleDragEnd(letter: string, pointerX: number, pointerY: number) {
    // Padded rather than exact containment -- an imprecise pointing
    // device (trackpad especially) makes landing inside a small exact
    // box unreliable even when visually "close enough," so a release a
    // little outside a slot's edge still counts as that slot.
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

    if (slotIndex === -1 || placed[slotIndex] !== null) {
      // Dropped outside any slot, or the slot is already filled -- stays
      // in the tray, no feedback needed (this isn't a wrong answer, just
      // a miss).
      return
    }

    if (letters[slotIndex] === letter) {
      playSound('correct')
      setPlaced((prev) => {
        const next = [...prev]
        next[slotIndex] = letter
        return next
      })
      setUsedLetters((prev) => new Set(prev).add(letter))
      setCelebrate(slotIndex)
      setTimeout(() => setCelebrate(null), 400)

      if (correctCount + 1 === total) {
        playSound('complete')
        setCompleted(true)
        onComplete(sessionId, total)
      }
    } else {
      // Incorrect -- gentle shake feedback; dragSnapToOrigin returns
      // the tile to its tray position automatically.
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
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">{instructions}</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          {correctCount} / {total}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4 sm:gap-5">
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

      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {placed.map((letter, i) => (
          <motion.div
            key={i}
            ref={(el) => {
              slotRefs.current[i] = el
            }}
            animate={celebrate === i ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: 0.4 }}
            className={`w-14 h-14 flex items-center justify-center rounded-xl border-2 border-dashed text-2xl font-black transition-colors ${
              letter
                ? 'border-primary-700 dark:border-primary-400 bg-primary-50 dark:bg-primary-950 text-primary-800 dark:text-primary-300'
                : 'border-stone-300 dark:border-stone-700 text-stone-300 dark:text-stone-700'
            }`}
          >
            {letter ?? ''}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
