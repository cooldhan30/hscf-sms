'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { playSound } from '@/lib/gameRoom/sound'
import { classify } from '@/lib/gameRoom/modules/uyirKurilNedil/sortGame'
import type { KurilNedilType } from '@/lib/gameRoom/modules/uyirKurilNedil/letters'
import { InteractiveCompletionScreen } from './InteractiveCompletionScreen'

interface UyirKurilNedilSortGameProps {
  sessionId: string
  tiles: string[]
  instructions: string
  onComplete: (sessionId: string, score: number) => Promise<void>
  onRestart: () => void
}

const TOTAL = 12

// Classify-into-one-of-two-boxes -- a different shape from
// TamilLetterOrderGame's ordered slots (10 fixed positions), since here
// there are only two destinations and a letter is correct in EITHER of
// two ways depending on its type, not one fixed index. Kept as its own
// component rather than forcing it through the order-game's per-slot
// contract. Entirely client-side until the single onComplete call, same
// as every other interactive game here.
export function UyirKurilNedilSortGame({
  sessionId,
  tiles,
  instructions,
  onComplete,
  onRestart,
}: UyirKurilNedilSortGameProps) {
  const [tray, setTray] = useState<string[]>(tiles)
  const [kurilBox, setKurilBox] = useState<string[]>([])
  const [nedilBox, setNedilBox] = useState<string[]>([])
  const [shake, setShake] = useState<string | null>(null)
  const [celebrateBox, setCelebrateBox] = useState<KurilNedilType | null>(null)
  const [completed, setCompleted] = useState(false)
  const kurilRef = useRef<HTMLDivElement | null>(null)
  const nedilRef = useRef<HTMLDivElement | null>(null)

  const correctCount = kurilBox.length + nedilBox.length

  function handleDragEnd(letter: string, pointerX: number, pointerY: number) {
    const inBox = (el: HTMLDivElement | null) => {
      if (!el) return false
      const rect = el.getBoundingClientRect()
      return pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom
    }

    let target: KurilNedilType | null = null
    if (inBox(kurilRef.current)) target = 'kuril'
    else if (inBox(nedilRef.current)) target = 'nedil'

    if (!target) return

    const actual = classify(letter)
    if (actual === target) {
      playSound('correct')
      setTray((prev) => prev.filter((t) => t !== letter))
      if (target === 'kuril') setKurilBox((prev) => [...prev, letter])
      else setNedilBox((prev) => [...prev, letter])
      setCelebrateBox(target)
      setTimeout(() => setCelebrateBox(null), 400)

      if (correctCount + 1 === TOTAL) {
        playSound('complete')
        setCompleted(true)
        onComplete(sessionId, TOTAL)
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
        score={TOTAL}
        maxScore={TOTAL}
        message="குறில் மற்றும் நெடில் எழுத்துகளை சரியாக வகைப்படுத்திவிட்டீர்கள்!"
        onPlayAgain={onRestart}
      />
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">{instructions}</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          {correctCount} / {TOTAL}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3 min-h-[5rem]">
        {tray.map((letter) => (
          <motion.div
            key={letter}
            drag
            dragSnapToOrigin
            dragElastic={0.2}
            whileDrag={{ scale: 1.15, zIndex: 10 }}
            onDragEnd={(_e, info) => handleDragEnd(letter, info.point.x, info.point.y)}
            animate={shake === letter ? { x: [0, -8, 8, -8, 0] } : {}}
            transition={{ duration: 0.3 }}
            className="w-16 h-16 flex items-center justify-center rounded-2xl border-2 border-primary-700 dark:border-primary-400 bg-white dark:bg-stone-900 text-3xl font-black text-primary-800 dark:text-primary-300 cursor-grab active:cursor-grabbing shadow-md select-none touch-none"
          >
            {letter}
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <motion.div
          ref={kurilRef}
          animate={celebrateBox === 'kuril' ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex-1 min-h-[8rem] rounded-2xl border-4 border-dashed border-primary-700 dark:border-primary-400 bg-primary-50 dark:bg-primary-950 p-4 flex flex-col items-center gap-3"
        >
          <p className="text-2xl font-black text-primary-800 dark:text-primary-300">குறில்</p>
          <div className="flex flex-wrap justify-center gap-2">
            {kurilBox.map((letter) => (
              <span
                key={letter}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-white dark:bg-stone-900 border-2 border-primary-700 dark:border-primary-400 text-xl font-black text-primary-800 dark:text-primary-300"
              >
                {letter}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          ref={nedilRef}
          animate={celebrateBox === 'nedil' ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex-1 min-h-[8rem] rounded-2xl border-4 border-dashed border-amber-600 dark:border-amber-400 bg-amber-50 dark:bg-amber-950 p-4 flex flex-col items-center gap-3"
        >
          <p className="text-2xl font-black text-amber-800 dark:text-amber-300">நெடில்</p>
          <div className="flex flex-wrap justify-center gap-2">
            {nedilBox.map((letter) => (
              <span
                key={letter}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-white dark:bg-stone-900 border-2 border-amber-600 dark:border-amber-400 text-xl font-black text-amber-800 dark:text-amber-300"
              >
                {letter}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
