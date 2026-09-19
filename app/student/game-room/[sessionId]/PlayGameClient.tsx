'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'

const POLL_INTERVAL_MS = 2000
// Auto-advance delay after showing correct/incorrect feedback -- per
// spec, "approximately 1.5-2 seconds" before the next poll naturally
// picks up the new current_index.
const FEEDBACK_DELAY_MS = 1800

interface QuestionPayload {
  id: string
  prompt: string
  options: string[]
  // Optional -- only modules with a category concept populate this
  // (see lib/gameRoom/gameModule.ts's GameQuestion.category). Rendered
  // as a small badge above the prompt when present, e.g. so a Mixed-
  // mode grammar question tells the student which concept ("திணை",
  // "பால், etc) they're being asked about -- without this, a student
  // has no way to know what a Mixed-mode question is even testing.
  category?: string | null
  categoryLabel?: string | null
}

interface StatePayload {
  sessionStatus: 'waiting' | 'active' | 'paused' | 'ended'
  currentIndex: number
  totalQuestions: number
  score: number
  completed: boolean
  rank: number
  question: QuestionPayload | null
  remainingSeconds: number | null
}

interface AnswerFeedback {
  isCorrect: boolean
  correctAnswer: string
  explanation: string
  points: number
  newScore: number
  rank: number
  completed: boolean
}

// The entire rendering surface here is driven ONLY by the module-
// agnostic GameQuestion shape (prompt/options/explanation) coming back
// from /api/game-room/state -- nothing in this component is specific to
// the Tamil grammar quiz, so a future second game module needs no
// changes here. Polls every 2s (mirrors StoryGeneratorClient.tsx's
// interval+ref+cleanup idiom) -- the student is now a real Clerk-
// authenticated session (see lib/gameRoom/requirePlayer.ts), so no
// bearer token/localStorage plumbing is needed; sessionId in the URL is
// the only thing the client needs to track.
export function PlayGameClient({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<StatePayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  const lastSeenIndexRef = useRef<number | null>(null)
  const timeoutHandledRef = useRef(false)

  async function poll() {
    try {
      const res = await fetch('/api/game-room/state', {
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

      // A NEW question just arrived (current_index advanced, or this is
      // the first poll of one) -- clear any stale feedback/selection from
      // the previous question so the UI resets cleanly.
      if (data.currentIndex !== lastSeenIndexRef.current) {
        lastSeenIndexRef.current = data.currentIndex
        setSelectedAnswer(null)
        setFeedback(null)
        timeoutHandledRef.current = false
      }

      setState(data)
    } catch {
      setError('Lost connection -- retrying...')
    }
  }

  useEffect(() => {
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Client-side timeout detection: if the poll shows 0 seconds left and
  // this question hasn't been answered or already auto-submitted as a
  // timeout, submit a null answer -- the server independently computes
  // isCorrect=false/points=0 for this, so the client can only ever
  // report "time's up," never fake a result.
  useEffect(() => {
    if (
      state?.sessionStatus === 'active' &&
      !state.completed &&
      state.remainingSeconds === 0 &&
      !feedback &&
      !submitting &&
      !timeoutHandledRef.current
    ) {
      timeoutHandledRef.current = true
      handleAnswer(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.remainingSeconds, state?.sessionStatus, state?.completed, feedback, submitting])

  async function handleAnswer(answer: string | null) {
    if (!state || submitting || feedback) return
    setSubmitting(true)
    setSelectedAnswer(answer)

    const res = await fetch('/api/game-room/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, questionIndex: state.currentIndex, selectedAnswer: answer }),
    })
    const data = await res.json().catch(() => null)
    setSubmitting(false)

    if (res.ok && data) {
      setFeedback(data)
      setTimeout(() => poll(), FEEDBACK_DELAY_MS)
    }
  }

  if (!state) {
    return <CenteredMessage>Loading...</CenteredMessage>
  }

  if (error) {
    return <CenteredMessage>{error}</CenteredMessage>
  }

  if (state.sessionStatus === 'waiting') {
    return (
      <CenteredMessage>
        <p className="text-2xl">⏳</p>
        <p className="mt-3 font-semibold">Waiting for the teacher to start...</p>
      </CenteredMessage>
    )
  }

  if (state.sessionStatus === 'paused') {
    return (
      <CenteredMessage>
        <p className="text-2xl">⏸️</p>
        <p className="mt-3 font-semibold">Game paused by your teacher</p>
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
        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">Final Rank: #{state.rank}</p>
      </CenteredMessage>
    )
  }

  if (state.completed) {
    return (
      <CenteredMessage>
        <p className="text-3xl">🎉</p>
        <h1 className="text-xl font-bold mt-3">You finished!</h1>
        <div className="mt-4 space-y-1">
          <p className="text-4xl font-black text-primary-700 dark:text-primary-400">{state.score}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Your Score</p>
        </div>
        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">Current Rank: #{state.rank}</p>
        <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">Waiting for your classmates to finish...</p>
      </CenteredMessage>
    )
  }

  if (feedback) {
    return (
      <CenteredMessage>
        <p className="text-3xl">{feedback.isCorrect ? '🎉' : '😅'}</p>
        <p className={`mt-2 font-bold text-lg ${feedback.isCorrect ? 'text-primary-700 dark:text-primary-400' : 'text-terracotta-600 dark:text-terracotta-400'}`}>
          {feedback.isCorrect ? 'Correct!' : 'Not quite'}
        </p>
        <p className="mt-2 text-2xl font-black">{feedback.correctAnswer}</p>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{feedback.explanation}</p>
        <p className="mt-3 font-semibold text-primary-700 dark:text-primary-400">+{feedback.points} points</p>
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">Score: {feedback.newScore} · Rank #{feedback.rank}</p>
      </CenteredMessage>
    )
  }

  if (!state.question) {
    return <CenteredMessage>Loading question...</CenteredMessage>
  }

  const progressPct = Math.round((state.currentIndex / state.totalQuestions) * 100)

  return (
    <div className="flex flex-col px-4 py-6">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
        <div className="flex items-center justify-between text-sm text-stone-500 dark:text-stone-400 mb-2">
          <span>
            Question {state.currentIndex + 1} / {state.totalQuestions}
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

        <div className="flex-1 flex flex-col items-center justify-center py-8 gap-4">
          {state.question.categoryLabel && (
            <Badge variant="secondary" size="sm">
              {state.question.categoryLabel}
            </Badge>
          )}
          {/* Confirmed as a real bug: modules that fold a word and its
              question text onto one prompt line (e.g. "சிரிப்பான் —
              இது எந்தக் காலம்?") rendered both halves crammed onto the
              same text-4xl line, hard to read at a glance. Split on the
              module's own em-dash separator into two visually distinct
              lines -- the word large and bold, the question smaller and
              muted below it -- while staying a no-op for any module
              whose prompt has no separator (just the whole prompt on
              one line, as before). */}
          {(() => {
            const [word, ...rest] = state.question.prompt.split(' — ')
            const questionText = rest.join(' — ')
            return (
              <div className="text-center">
                <p className="text-4xl font-black text-stone-800 dark:text-stone-100 tracking-wide">{word}</p>
                {questionText && (
                  <p className="text-xl font-semibold text-stone-500 dark:text-stone-400 mt-2">{questionText}</p>
                )}
              </div>
            )
          })()}
        </div>

        {/* Different game modules have different option counts (2-5) --
            a fixed 2-column grid left an odd option alone on its own row
            for a 3-option question and cramped 5 options awkwardly, so
            the column count adapts to how many options this question
            actually has. 2 or 4 options fit a clean 2-column grid; 3
            stays single-column until there's genuinely enough width for
            3 across (md:, not sm: -- confirmed as a real bug: sm:'s
            640px breakpoint switched to 3 columns before there was
            enough room, clipping longer option text like "எதிர்காலம்");
            5 wraps into 2 columns (uneven last row) rather than
            shrinking to fit one row. Text wraps and buttons grow to fit
            rather than truncating, so a long option is never cut off. */}
        <div
          className={`grid gap-3 mt-6 ${
            state.question.options.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2'
          }`}
        >
          {state.question.options.map((opt) => (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              disabled={submitting}
              className={`py-6 px-4 rounded-2xl border-2 text-xl sm:text-2xl font-bold transition-colors disabled:opacity-50 break-words ${
                selectedAnswer === opt
                  ? 'border-primary-700 bg-primary-50 dark:bg-primary-950 text-primary-800 dark:text-primary-300'
                  : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 active:scale-95'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
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
