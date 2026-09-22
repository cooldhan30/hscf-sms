'use client'

import { useEffect, useRef, useState } from 'react'
import { QuestionPanel } from '@/components/gameRoomV2'
import { QuestionInput } from './QuestionInput'
import { playSound } from './playSound'
import { useSoundPreference } from './useSoundPreference'
import type { GameRoomQuestionType } from '@/lib/gameRoomV2/domain'

export interface QuestionOverlayQuestion {
  id: string
  questionType: GameRoomQuestionType
  prompt: string
  payload: Record<string, unknown>
  mediaUrl: string | null
  points: number
}

export interface AnswerResult {
  correct: boolean
  answer: unknown
  responseTimeMs: number
  points: number
}

// THE universal question interface every GameRoom V2 game engine
// invokes -- the literal "SHOW QUESTION -> receive
// correct/incorrect/answer/response time/points" contract from the
// spec. An engine mounts this with a sessionId and an onResult
// callback; it never sees a question's payload, never grades anything
// itself, and never computes points -- all of that happens server-side
// (see app/api/gameroom-v2/sessions/[id]/{state,answer}/route.ts) and
// is reported back through onResult. This is what makes "the game
// should not need to understand question implementation details" true
// in practice: Tower Defense, Boss Battle, Racing, etc. all mount the
// exact same component and only ever react to onResult, regardless of
// whether the underlying question was MULTIPLE_CHOICE, MATCH, or
// CATEGORIZE.
export function QuestionOverlay({
  sessionId,
  question,
  questionIndex,
  remainingSeconds,
  onResult,
}: {
  sessionId: string
  question: QuestionOverlayQuestion
  questionIndex: number
  remainingSeconds: number | null
  onResult: (result: AnswerResult) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [pendingAnswer, setPendingAnswer] = useState<unknown>(undefined)
  const { soundEnabled } = useSoundPreference()
  const timeoutHandledRef = useRef(false)
  const lastQuestionIdRef = useRef(question.id)

  useEffect(() => {
    if (lastQuestionIdRef.current !== question.id) {
      lastQuestionIdRef.current = question.id
      setPendingAnswer(undefined)
      setSubmitting(false)
      timeoutHandledRef.current = false
    }
  }, [question.id])

  async function submit(answer: unknown) {
    if (submitting) return
    setSubmitting(true)
    setPendingAnswer(answer)

    const res = await fetch(`/api/gameroom-v2/sessions/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex, answer }),
    })
    const data = await res.json().catch(() => null)
    setSubmitting(false)

    if (!res.ok || !data) return

    playSound(data.isCorrect ? 'correct' : 'incorrect', soundEnabled)
    onResult({
      correct: data.isCorrect,
      answer,
      responseTimeMs: data.responseTimeMs,
      points: data.points,
    })
  }

  // Client-side timeout detection: submits a null answer once the
  // server-reported remaining time hits 0 -- the server independently
  // (re-)computes isCorrect=false/points=0 for this, so the client can
  // only ever report "time's up," never fake a result.
  useEffect(() => {
    if (remainingSeconds === 0 && !submitting && !timeoutHandledRef.current) {
      timeoutHandledRef.current = true
      submit(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, submitting])

  return (
    <QuestionPanel prompt={question.prompt} mediaUrl={question.mediaUrl}>
      <QuestionInput
        questionType={question.questionType}
        payload={question.payload}
        disabled={submitting}
        pendingAnswer={pendingAnswer}
        onSubmit={submit}
      />
    </QuestionPanel>
  )
}
