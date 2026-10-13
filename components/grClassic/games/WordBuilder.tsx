'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { tilesFor } from '@/lib/grClassic/graphemes'
import { gradeOrder, isOrderCorrect } from '@/lib/grClassic/scoring'
import { shuffleAwayFrom } from '@/lib/grClassic/shuffle'
import type { OrderQuestion, QuestionResult } from '@/lib/grClassic/types'
import { Button } from '../ui'
import { QuestionPrompt } from './QuizQuestion'

type Tile = { id: number; text: string }

// Word Builder: tap tiles to fill the slots in order; tap a placed tile to
// send it back. Tiles are whole Tamil letters (lib/grClassic/graphemes.ts),
// never broken vowel signs. Graded on the first Check. In practice a wrong
// try can be retried (or the answer shown); in an assignment the first
// Check is final and the answer is not revealed.
export function WordBuilder({ question, reveal, hints, onAnswered }: { question: OrderQuestion; reveal: boolean; hints: boolean; onAnswered: (r: QuestionResult) => void }) {
  const answerTiles = useMemo(() => tilesFor(question), [question])
  const tiles = useMemo<Tile[]>(() => shuffleAwayFrom(answerTiles.map((text, id) => ({ id, text }))), [answerTiles])
  const [slots, setSlots] = useState<(Tile | null)[]>(() => answerTiles.map(() => null))
  const [firstTry, setFirstTry] = useState<string[] | null>(null)
  const [status, setStatus] = useState<'building' | 'wrong' | 'right' | 'locked' | 'shown'>('building')
  const [showHint, setShowHint] = useState(false)
  const placed = new Set(slots.filter(Boolean).map((t) => t!.id))
  const full = slots.every(Boolean)
  const finished = status === 'right' || status === 'locked' || status === 'shown'
  const words = question.unit === 'words'

  const place = (t: Tile) => {
    if (finished) return
    setStatus('building')
    setSlots((s) => {
      const i = s.findIndex((x) => x === null)
      if (i === -1) return s
      const next = s.slice()
      next[i] = t
      return next
    })
  }
  const unplace = (i: number) => {
    if (finished) return
    setStatus('building')
    setSlots((s) => s.map((x, k) => (k === i ? null : x)))
  }

  const check = () => {
    const attempt = slots.map((t) => t!.text)
    const first = firstTry ?? attempt
    if (!firstTry) setFirstTry(attempt)
    if (isOrderCorrect(question, attempt)) {
      setStatus('right')
      onAnswered(gradeOrder(question, first))
    } else if (!reveal) {
      setStatus('locked')
      onAnswered(gradeOrder(question, first))
    } else {
      setStatus('wrong')
    }
  }

  const showAnswer = () => {
    setSlots(answerTiles.map((_, i) => tiles.find((t) => t.id === i)!))
    setStatus('shown')
    onAnswered(gradeOrder(question, firstTry ?? []))
  }

  const slotLook = status === 'right' || status === 'shown' ? 'bg-emerald-100 ring-emerald-500 text-emerald-900' : status === 'wrong' ? 'bg-rose-50 ring-rose-400 text-rose-900' : 'bg-white ring-slate-300 text-slate-900'

  return (
    <div>
      <QuestionPrompt prompt={question.prompt} promptEn={question.promptEn ? `Clue: ${question.promptEn}` : undefined} />

      <motion.ol
        aria-label="Your answer"
        animate={status === 'wrong' ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3"
      >
        {slots.map((t, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => t && unplace(i)}
              disabled={!t || finished}
              aria-label={t ? `Position ${i + 1}: ${t.text}. Tap to remove.` : `Position ${i + 1}: empty`}
              className={`grid place-items-center rounded-2xl font-extrabold ring-2 transition ${words ? 'h-16 min-w-[6rem] px-4 text-xl sm:text-2xl' : 'h-16 w-16 text-3xl sm:h-20 sm:w-20 sm:text-4xl'} ${t ? slotLook : 'border-2 border-dashed border-slate-300 bg-transparent ring-transparent'}`}
            >
              {t?.text ?? ''}
            </button>
          </li>
        ))}
      </motion.ol>

      <ul aria-label="Tiles to use" className="mt-8 flex min-h-[5rem] flex-wrap justify-center gap-3">
        {tiles.map((t) => (
          <li key={t.id}>
            <motion.button
              type="button"
              layout
              onClick={() => place(t)}
              disabled={placed.has(t.id) || finished}
              aria-label={`Tile ${t.text}`}
              className={`grid place-items-center rounded-2xl bg-amber-400 font-extrabold text-amber-950 shadow-[0_5px_0_0_#b45309] transition hover:bg-amber-300 active:translate-y-1 active:shadow-none disabled:invisible ${words ? 'h-16 px-4 text-xl sm:text-2xl' : 'h-16 w-16 text-3xl sm:h-20 sm:w-20 sm:text-4xl'}`}
            >
              {t.text}
            </motion.button>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {!finished && (
          <Button tone="teal" size="lg" disabled={!full} onClick={check}>
            Check ✓
          </Button>
        )}
        {status === 'wrong' && (
          <>
            <Button tone="plain" onClick={() => setSlots(answerTiles.map(() => null))}>
              Clear
            </Button>
            <Button tone="ghost" onClick={showAnswer}>
              Show answer
            </Button>
          </>
        )}
        {hints && !finished && !showHint && (
          <Button tone="ghost" size="sm" onClick={() => setShowHint(true)}>
            💡 Hint
          </Button>
        )}
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-center font-bold">
        {status === 'wrong' && <span className="text-rose-700">Not quite — move the tiles and try again.</span>}
        {showHint && !finished && (
          <span className="text-amber-800">
            {words ? 'First word' : 'First letter'}: {answerTiles[0]}
            {question.hint ? ` · ${question.hint}` : ''}
          </span>
        )}
      </p>
    </div>
  )
}
