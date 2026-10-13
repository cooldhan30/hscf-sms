'use client'

import { useState } from 'react'
import type { CheckResult, PlayQuestion, PlaySession } from '@/lib/grClassic/play'
import type { QuestionResult } from '@/lib/grClassic/types'
import { AnswerButton, type AnswerState } from './AnswerButton'
import { Button } from '../ui'

type ChoicePlay = Extract<PlayQuestion, { kind: 'choice' }>

// Classic Quiz, one question. The device never knows the answer: the
// choice goes to `session.check`, which says right/wrong and -- only when
// the mode allows it -- which option was right.
export function QuizQuestion({ question, session, reveal, hints, onAnswered }: { question: ChoicePlay; session: PlaySession; reveal: boolean; hints: boolean; onAnswered: (r: QuestionResult) => void }) {
  const [chosen, setChosen] = useState<number | null>(null)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [hidden, setHidden] = useState<number | null>(null)
  const [error, setError] = useState('')

  const choose = async (i: number) => {
    if (chosen !== null) return
    setChosen(i)
    setError('')
    try {
      const res = await session.check(question.id, { kind: 'choice', choice: i })
      setResult(res)
      onAnswered({ questionId: question.id, prompt: question.prompt, correctUnits: res.correct ? 1 : 0, totalUnits: 1, given: question.options[i], expected: res.expected ?? '', explanation: res.explanation })
    } catch (e) {
      setChosen(null)
      setError(e instanceof Error && e.message && !e.message.startsWith('HTTP') && !e.message.startsWith('Failed') ? e.message : "Couldn't send your answer. Check the internet and tap again.")
    }
  }

  const useHint = async () => {
    try {
      const h = await session.hint(question.id)
      if ('removeOption' in h) setHidden(h.removeOption)
    } catch {
      setError("Couldn't get a hint right now.")
    }
  }

  const stateOf = (i: number): AnswerState => {
    if (chosen === null) return hidden === i ? 'dim' : 'idle'
    if (!result || !reveal || result.correctIndex === undefined) return i === chosen ? 'chosen' : 'dim'
    if (i === result.correctIndex) return 'correct'
    return i === chosen ? 'wrong' : 'dim'
  }

  return (
    <div>
      <QuestionPrompt prompt={question.prompt} promptEn={question.promptEn} />
      <div className={`mt-6 grid gap-4 ${question.options.length > 2 ? 'sm:grid-cols-2' : ''}`}>
        {question.options.map((opt, i) => (
          <AnswerButton key={i} index={i} text={opt} state={stateOf(i)} disabled={chosen !== null || hidden === i} onClick={() => choose(i)} />
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-center font-bold text-rose-700">
          {error}
        </p>
      )}
      {hints && chosen === null && hidden === null && question.options.length > 2 && (
        <div className="mt-4 text-center">
          <Button tone="ghost" size="sm" onClick={useHint}>
            💡 Hint: remove one wrong answer
          </Button>
        </div>
      )}
    </div>
  )
}

export function QuestionPrompt({ prompt, promptEn }: { prompt: string; promptEn?: string }) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-extrabold leading-[1.4] text-slate-900 sm:text-3xl">{prompt}</h2>
      {promptEn && <p className="mt-2 text-base font-medium text-slate-500">{promptEn}</p>}
    </div>
  )
}
