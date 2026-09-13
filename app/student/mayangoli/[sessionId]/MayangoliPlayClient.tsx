'use client'

import { useEffect, useRef, useState } from 'react'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { subscribeToMayangoliSession } from '@/lib/gameRoom/modules/mayangoli/realtime'

// Fallback poll interval -- Realtime (subscribeToMayangoliSession) is
// the primary update mechanism here (unlike the self-paced engine,
// where students only poll), since a synchronized game needs every
// client to react the instant the room advances; this is just the
// safety net for a publication-registration issue, same reasoning as
// the host dashboard's fallback interval.
const FALLBACK_POLL_MS = 4000
const REVEAL_TICK_MS = 1000

interface QuestionPayload {
  questionType: string
  prompt: string
  options: string[]
  supportingText: string | null
}

interface RevealPayload {
  correctAnswer: string
  totalAnswers: number
  correctAnswers: number
  percentCorrect: number
}

interface StatePayload {
  sessionStatus: 'waiting' | 'active' | 'reveal' | 'ended'
  currentQuestionIndex: number
  totalQuestions: number
  score: number
  currentStreak: number
  bestStreak: number
  remainingSeconds: number | null
  alreadyAnswered: boolean
  myAnswer: { selected_answer: string | null; is_correct: boolean; points: number } | null
  reveal: RevealPayload | null
  question: QuestionPayload | null
}

export function MayangoliPlayClient({ sessionId }: { sessionId: string }) {
  const supabase = useSupabaseBrowserClient()
  const [state, setState] = useState<StatePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const lastSeenIndexRef = useRef<number | null>(null)
  const lastSeenStatusRef = useRef<string | null>(null)

  async function poll() {
    try {
      const res = await fetch('/api/mayangoli/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data) {
        setError(data?.error || 'Lost connection to the game')
        return
      }

      setError(null)

      if (data.currentQuestionIndex !== lastSeenIndexRef.current || data.sessionStatus !== lastSeenStatusRef.current) {
        lastSeenIndexRef.current = data.currentQuestionIndex
        lastSeenStatusRef.current = data.sessionStatus
        // A new question (or a reveal/next transition) arrived -- clear
        // any stale local selection from the previous question.
        if (data.sessionStatus === 'active') setSelectedAnswer(null)
      }

      setState(data)
    } catch {
      setError('Lost connection -- retrying...')
    }
  }

  useEffect(() => {
    poll()
    const channel = subscribeToMayangoliSession(supabase, sessionId, poll)
    const interval = setInterval(poll, FALLBACK_POLL_MS)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Local 1s countdown tick during 'active' so the timer visibly
  // counts down between poll/Realtime refreshes -- purely cosmetic;
  // the server's own remainingSeconds (refreshed on every poll/event)
  // is what actually gates the client-side auto-timeout below.
  useEffect(() => {
    if (state?.sessionStatus !== 'active' || state.remainingSeconds === null) return
    const tick = setInterval(() => {
      setState((prev) =>
        prev && prev.remainingSeconds !== null ? { ...prev, remainingSeconds: Math.max(0, prev.remainingSeconds - 1) } : prev
      )
    }, REVEAL_TICK_MS)
    return () => clearInterval(tick)
    // Deliberately excludes state.remainingSeconds -- this effect only
    // needs to (re)start the ticker when the question/status changes,
    // not on every tick's own state update (which would restart the
    // interval every second).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.sessionStatus, state?.currentQuestionIndex])

  async function handleAnswer(answer: string) {
    if (!state || submitting || state.alreadyAnswered) return
    setSubmitting(true)
    setSelectedAnswer(answer)

    const res = await fetch('/api/mayangoli/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, questionIndex: state.currentQuestionIndex, selectedAnswer: answer }),
    })
    const data = await res.json().catch(() => null)
    setSubmitting(false)

    if (res.ok && data) {
      setState((prev) =>
        prev
          ? {
              ...prev,
              alreadyAnswered: true,
              myAnswer: { selected_answer: answer, is_correct: data.isCorrect, points: data.points },
              score: data.newScore,
              currentStreak: data.newStreak,
            }
          : prev
      )
    } else {
      // A 409 here almost always means the room already moved on
      // (advanced past this question) between the tap and the request
      // landing -- refresh state instead of leaving a stuck spinner.
      poll()
    }
  }

  if (!state) return <CenteredMessage>Loading...</CenteredMessage>
  if (error) return <CenteredMessage>{error}</CenteredMessage>

  if (state.sessionStatus === 'waiting') {
    return (
      <CenteredMessage>
        <p className="text-2xl">⏳</p>
        <p className="mt-3 font-semibold">Waiting for the teacher to start...</p>
      </CenteredMessage>
    )
  }

  if (state.sessionStatus === 'ended') {
    return (
      <CenteredMessage>
        <p className="text-3xl">🏆</p>
        <h1 className="text-xl font-bold mt-3">Game Complete!</h1>
        <div className="mt-4 space-y-1">
          <p className="text-4xl font-black text-primary-700 dark:text-primary-400">{state.score}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Final Score</p>
        </div>
        {state.bestStreak >= 3 && (
          <p className="mt-2 text-sm text-gold-600 dark:text-gold-400 font-semibold">🔥 Best streak: {state.bestStreak}</p>
        )}
      </CenteredMessage>
    )
  }

  if (!state.question) {
    return <CenteredMessage>Loading question...</CenteredMessage>
  }

  const progressPct = Math.round((state.currentQuestionIndex / Math.max(1, state.totalQuestions)) * 100)

  if (state.sessionStatus === 'reveal') {
    const wasCorrect = state.myAnswer?.is_correct ?? false
    return (
      <div className="flex flex-col px-4 py-6">
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col text-center">
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
            Question {state.currentQuestionIndex + 1} / {state.totalQuestions}
          </p>

          {state.myAnswer ? (
            <>
              <p className="text-3xl">{wasCorrect ? '🎉' : '😅'}</p>
              <p className={`mt-2 font-bold text-lg ${wasCorrect ? 'text-primary-700 dark:text-primary-400' : 'text-terracotta-600 dark:text-terracotta-400'}`}>
                {wasCorrect ? 'Correct!' : 'Not quite'}
              </p>
              {!wasCorrect && <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">You picked: {state.myAnswer.selected_answer ?? '(no answer)'}</p>}
              <p className="mt-3 font-semibold text-primary-700 dark:text-primary-400">+{state.myAnswer.points} points</p>
            </>
          ) : (
            <p className="mt-2 font-bold text-lg text-stone-500 dark:text-stone-400">Time&apos;s up!</p>
          )}

          <p className="mt-4 text-2xl font-black font-tamil text-stone-800 dark:text-stone-100">
            {state.reveal?.correctAnswer}
          </p>

          {state.reveal && (
            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
              {state.reveal.percentCorrect}% of the class answered correctly
            </p>
          )}

          <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">Score: {state.score}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col px-4 py-6">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
        <div className="flex items-center justify-between text-sm text-stone-500 dark:text-stone-400 mb-2">
          <span>
            Question {state.currentQuestionIndex + 1} / {state.totalQuestions}
          </span>
          {state.remainingSeconds !== null && (
            <span className={`font-bold ${state.remainingSeconds <= 5 ? 'text-terracotta-600 dark:text-terracotta-400' : ''}`}>
              ⏱ {state.remainingSeconds}
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden mb-6">
          <div className="h-full bg-primary-600 dark:bg-primary-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        {state.currentStreak >= 3 && (
          <p className="text-center text-sm font-semibold text-gold-600 dark:text-gold-400 mb-2">🔥 {state.currentStreak} streak!</p>
        )}

        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
          {state.question.supportingText && (
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-2">{state.question.supportingText}</p>
          )}
          <p className="text-4xl font-black text-center text-stone-800 dark:text-stone-100 tracking-wide font-tamil">
            {state.question.prompt}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          {state.question.options.map((opt) => (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              disabled={submitting || state.alreadyAnswered}
              className={`py-6 rounded-2xl border-2 text-2xl font-bold font-tamil transition-colors disabled:opacity-50 ${
                selectedAnswer === opt
                  ? 'border-primary-700 bg-primary-50 dark:bg-primary-950 text-primary-800 dark:text-primary-300'
                  : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 active:scale-95'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        {state.alreadyAnswered && (
          <p className="text-center text-sm text-stone-500 dark:text-stone-400 mt-4">Waiting for the rest of the class...</p>
        )}
      </div>
    </div>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center px-4 py-16">
      <div className="max-w-sm w-full text-center text-stone-700 dark:text-stone-200">{children}</div>
    </div>
  )
}
