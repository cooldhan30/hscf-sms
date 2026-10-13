'use client'

import { useState } from 'react'
import { gradeChoice } from '@/lib/grClassic/scoring'
import type { ChoiceQuestion, QuestionResult } from '@/lib/grClassic/types'
import { AnswerButton, type AnswerState } from './AnswerButton'
import { Button } from '../ui'

// Classic Quiz, one question. `reveal` shows right/wrong on the buttons
// (practice and preview); assignments only mark the chosen answer.
export function QuizQuestion({ question, reveal, hints, onAnswered }: { question: ChoiceQuestion; reveal: boolean; hints: boolean; onAnswered: (r: QuestionResult) => void }) {
  const [chosen, setChosen] = useState<number | null>(null)
  const [hidden, setHidden] = useState<number | null>(null)

  const choose = (i: number) => {
    if (chosen !== null) return
    setChosen(i)
    onAnswered(gradeChoice(question, i))
  }

  // Hint: take away one wrong answer.
  const useHint = () => {
    const wrong = question.options.map((_, i) => i).filter((i) => i !== question.answerIndex)
    setHidden(wrong[Math.floor(Math.random() * wrong.length)])
  }

  const stateOf = (i: number): AnswerState => {
    if (chosen === null) return hidden === i ? 'dim' : 'idle'
    if (!reveal) return i === chosen ? 'chosen' : 'dim'
    if (i === question.answerIndex) return 'correct'
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
