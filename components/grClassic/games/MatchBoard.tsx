'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { gradeMatch } from '@/lib/grClassic/scoring'
import { shuffleAwayFrom } from '@/lib/grClassic/shuffle'
import type { MatchQuestion, QuestionResult } from '@/lib/grClassic/types'
import { Button } from '../ui'
import { QuestionPrompt } from './QuizQuestion'

const PAIR_COLORS = [
  'bg-teal-100 ring-teal-500 text-teal-900',
  'bg-rose-100 ring-rose-500 text-rose-900',
  'bg-amber-100 ring-amber-500 text-amber-900',
  'bg-indigo-100 ring-indigo-500 text-indigo-900',
  'bg-emerald-100 ring-emerald-500 text-emerald-900',
  'bg-fuchsia-100 ring-fuchsia-500 text-fuchsia-900',
]

// Match the Pairs: tap an item on one side, then its partner on the other
// (either side first). Plain buttons, so it works with a keyboard and a
// screen reader -- no dragging needed. A pair counts towards the grade
// only if it was matched right on the first try.
export function MatchBoard({ question, hints, onAnswered }: { question: MatchQuestion; hints: boolean; onAnswered: (r: QuestionResult) => void }) {
  const rights = useMemo(() => shuffleAwayFrom(question.pairs.map((p) => p.right)), [question])
  const [left, setLeft] = useState<number | null>(null)
  const [right, setRight] = useState<string | null>(null)
  const [matched, setMatched] = useState<Record<number, string>>({})
  const [firstPicks, setFirstPicks] = useState<Record<number, string>>({})
  const [wrong, setWrong] = useState<{ l: number; r: string } | null>(null)
  const [hint, setHint] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const done = Object.keys(matched).length === question.pairs.length

  useEffect(() => {
    if (done) onAnswered(gradeMatch(question, firstPicks))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  const attempt = (l: number, r: string) => {
    const picks = firstPicks[l] === undefined ? { ...firstPicks, [l]: r } : firstPicks
    setFirstPicks(picks)
    setLeft(null)
    setRight(null)
    setHint(null)
    if (question.pairs[l].right === r) {
      setMatched((m) => ({ ...m, [l]: r }))
      setMessage(`${question.pairs[l].left} and ${r} matched`)
    } else {
      setWrong({ l, r })
      setMessage(`${question.pairs[l].left} and ${r} don't go together. Try again.`)
      setTimeout(() => setWrong(null), 700)
    }
  }

  const tapLeft = (l: number) => {
    if (matched[l] !== undefined) return
    if (right !== null) attempt(l, right)
    else setLeft(left === l ? null : l)
  }
  const tapRight = (r: string) => {
    if (Object.values(matched).includes(r)) return
    if (left !== null) attempt(left, r)
    else setRight(right === r ? null : r)
  }

  const leftOf = (r: string) => Number(Object.keys(matched).find((k) => matched[Number(k)] === r))
  const cardBase = 'relative flex min-h-[4.5rem] w-full items-center justify-center rounded-2xl px-3 py-3 text-center text-xl font-bold ring-2 transition sm:text-2xl'

  const look = (isMatched: boolean, pairIndex: number, selected: boolean, isWrong: boolean, isHint: boolean) => {
    if (isMatched) return `${PAIR_COLORS[pairIndex % PAIR_COLORS.length]} ring-4`
    if (isWrong) return 'bg-rose-50 ring-rose-400 text-rose-900'
    if (selected) return 'bg-slate-900 ring-slate-900 text-white -translate-y-0.5 shadow-lg'
    if (isHint) return 'bg-white ring-amber-400 ring-4 text-slate-900 animate-pulse'
    return 'bg-white ring-slate-200 text-slate-900 shadow-[0_4px_0_0_#e2e8f0] hover:ring-slate-300'
  }

  return (
    <div>
      <QuestionPrompt prompt={question.prompt} promptEn={question.promptEn} />
      <p className="mt-2 text-center text-sm font-semibold text-slate-500">Tap one card, then its partner.</p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5">
        <ul className="space-y-3" aria-label="Items">
          {question.pairs.map((p, l) => (
            <li key={p.left}>
              <motion.button
                type="button"
                animate={wrong?.l === l ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                aria-pressed={left === l}
                aria-label={matched[l] !== undefined ? `${p.left}, matched with ${matched[l]}` : p.left}
                disabled={matched[l] !== undefined}
                onClick={() => tapLeft(l)}
                className={`${cardBase} ${look(matched[l] !== undefined, l, left === l, wrong?.l === l, hint === l)}`}
              >
                {matched[l] !== undefined && <PairBadge n={l + 1} />}
                {p.left}
              </motion.button>
            </li>
          ))}
        </ul>
        <ul className="space-y-3" aria-label="Partners">
          {rights.map((r) => {
            const isMatched = Object.values(matched).includes(r)
            const pairIndex = isMatched ? leftOf(r) : 0
            return (
              <li key={r}>
                <motion.button
                  type="button"
                  animate={wrong?.r === r ? { x: [0, 8, -8, 5, -5, 0] } : { x: 0 }}
                  transition={{ duration: 0.4 }}
                  aria-pressed={right === r}
                  aria-label={isMatched ? `${r}, matched` : r}
                  disabled={isMatched}
                  onClick={() => tapRight(r)}
                  className={`${cardBase} ${look(isMatched, pairIndex, right === r, wrong?.r === r, hint !== null && question.pairs[hint].right === r)}`}
                >
                  {isMatched && <PairBadge n={pairIndex + 1} />}
                  {r}
                </motion.button>
              </li>
            )
          })}
        </ul>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
      {hints && !done && hint === null && (
        <div className="mt-4 text-center">
          <Button tone="ghost" size="sm" onClick={() => setHint(question.pairs.findIndex((_, i) => matched[i] === undefined))}>
            💡 Hint: show me one pair
          </Button>
        </div>
      )}
    </div>
  )
}

function PairBadge({ n }: { n: number }) {
  return (
    <span aria-hidden className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/80 text-xs font-extrabold">
      {n}
    </span>
  )
}
