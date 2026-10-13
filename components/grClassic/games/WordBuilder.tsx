'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { joinTiles, tilesFor } from '@/lib/grClassic/graphemes'
import type { PlayQuestion, PlaySession } from '@/lib/grClassic/play'
import type { QuestionResult } from '@/lib/grClassic/types'
import { Button } from '../ui'
import { QuestionPrompt } from './QuizQuestion'

type OrderPlay = Extract<PlayQuestion, { kind: 'order' }>
type Tile = { id: number; text: string }

// Word Builder: tap tiles to fill the slots in order; tap a placed tile to
// send it back. Tiles arrive already shuffled, as whole Tamil letters (or
// words). The device doesn't know the order: each Check goes to
// `session.check`. Graded on the first Check. In practice a wrong try can
// be retried (or the answer shown); in an assignment the first Check is
// final and the answer is not revealed.
export function WordBuilder({ question, session, reveal, hints, onAnswered }: { question: OrderPlay; session: PlaySession; reveal: boolean; hints: boolean; onAnswered: (r: QuestionResult) => void }) {
  const tiles: Tile[] = question.tiles.map((text, id) => ({ id, text }))
  const [slots, setSlots] = useState<(Tile | null)[]>(() => question.tiles.map(() => null))
  const [first, setFirst] = useState<{ tiles: string[]; correct: boolean } | null>(null)
  const [expected, setExpected] = useState('')
  const [status, setStatus] = useState<'building' | 'checking' | 'wrong' | 'right' | 'locked' | 'shown'>('building')
  const [hintText, setHintText] = useState('')
  const [error, setError] = useState('')
  const placed = new Set(slots.filter(Boolean).map((t) => t!.id))
  const full = slots.every(Boolean)
  const finished = status === 'right' || status === 'locked' || status === 'shown'
  const words = question.unit === 'words'

  const result = (firstTry: { tiles: string[]; correct: boolean }, exp: string): QuestionResult => ({
    questionId: question.id,
    prompt: question.prompt,
    correctUnits: firstTry.correct ? 1 : 0,
    totalUnits: 1,
    given: joinTiles(firstTry.tiles, question.unit),
    expected: exp,
  })

  const place = (t: Tile) => {
    if (finished || status === 'checking') return
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
    if (finished || status === 'checking') return
    setStatus('building')
    setSlots((s) => s.map((x, k) => (k === i ? null : x)))
  }

  const check = async () => {
    const attempt = slots.map((t) => t!.text)
    setStatus('checking')
    setError('')
    try {
      const res = await session.check(question.id, { kind: 'order', tiles: attempt })
      const firstTry = first ?? { tiles: attempt, correct: res.correct }
      if (!first) setFirst(firstTry)
      if (res.expected) setExpected(res.expected)
      if (res.correct) {
        setStatus('right')
        onAnswered(result(firstTry, res.expected ?? joinTiles(attempt, question.unit)))
      } else if (!reveal) {
        setStatus('locked')
        onAnswered(result(firstTry, ''))
      } else {
        setStatus('wrong')
      }
    } catch {
      setStatus('building')
      setError("Couldn't check your answer. Check the internet and try again.")
    }
  }

  // Practice only: fill the slots with the right answer (known from the
  // last check, which revealed it).
  const showAnswer = () => {
    const pool = tiles.slice()
    const answer = tilesFor({ unit: question.unit, answer: expected })
    setSlots(answer.map((text) => {
      const k = pool.findIndex((t) => t.text === text)
      return k === -1 ? null : pool.splice(k, 1)[0]
    }))
    setStatus('shown')
    onAnswered(result(first ?? { tiles: [], correct: false }, expected))
  }

  const getHint = async () => {
    try {
      const h = await session.hint(question.id)
      if ('firstTile' in h) setHintText(`${words ? 'First word' : 'First letter'}: ${h.firstTile}${h.text ? ` · ${h.text}` : ''}`)
    } catch {
      setError("Couldn't get a hint right now.")
    }
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
          <Button tone="teal" size="lg" disabled={!full || status === 'checking'} onClick={check}>
            {status === 'checking' ? 'Checking…' : 'Check ✓'}
          </Button>
        )}
        {status === 'wrong' && (
          <>
            <Button tone="plain" onClick={() => setSlots(question.tiles.map(() => null))}>
              Clear
            </Button>
            {expected && (
              <Button tone="ghost" onClick={showAnswer}>
                Show answer
              </Button>
            )}
          </>
        )}
        {hints && !finished && !hintText && (
          <Button tone="ghost" size="sm" onClick={getHint}>
            💡 Hint
          </Button>
        )}
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-center font-bold">
        {status === 'wrong' && <span className="text-rose-700">Not quite — move the tiles and try again.</span>}
        {hintText && !finished && <span className="block text-amber-800">{hintText}</span>}
        {error && <span className="block text-rose-700">{error}</span>}
      </p>
    </div>
  )
}
