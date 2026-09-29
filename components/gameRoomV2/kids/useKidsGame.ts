'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { useGameV2Motion } from '@/components/gameRoomV2/useGameV2Motion'
import type { CelebrationHandle } from '@/components/gameRoomV2/celebration/CelebrationLayer'
import type { BaseSessionStatePayload } from '@/lib/gameRoomV2/gameplay/sessionPolling'
import { PRAISE } from '@/lib/gameRoomV2/kids'

// The session flow every Little Learners game shares: a "tap to start"
// (so the browser allows sound and speech), the question held on screen
// while feedback plays (the server has already moved on), answering
// through /answer (graded there -- never here), stars, streak, praise and
// the celebration burst. Each game only draws its own scene.

export interface KidsQuestionPayload {
  id: string
  questionType: string
  prompt: string
  payload: Record<string, unknown>
  mediaUrl: string | null
}

interface KidsSessionState extends BaseSessionStatePayload {
  question: KidsQuestionPayload | null
}

export type KidsFeedback = { kind: 'correct'; key: string } | { kind: 'wrong'; key: string; revealed: string | null } | null

export interface KidsAnswerResult {
  isCorrect: boolean
  revealed: string | null
}

export function useKidsGame({
  sessionId,
  feedbackMs = { correct: 1600, wrong: 2600 },
}: {
  sessionId: string
  feedbackMs?: { correct: number; wrong: number }
}) {
  const { soundEnabled, toggleSound } = useSoundPreference()
  const reduced = !!useGameV2Motion().reduced
  const [started, setStarted] = useState(false)
  const { state: session, error, result, poll, exit } = useGameSessionState<KidsSessionState>({ sessionId, enabled: started, soundEnabled })

  const [shown, setShown] = useState<{ index: number; question: KidsQuestionPayload } | null>(null)
  const [feedback, setFeedback] = useState<KidsFeedback>(null)
  const [answering, setAnswering] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [stars, setStars] = useState(0)
  const [streak, setStreak] = useState(0)
  const [praise, setPraise] = useState(PRAISE[0])
  const fx = useRef<CelebrationHandle>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (feedback || !session?.question) return
    if (!shown || shown.index !== session.currentIndex) setShown({ index: session.currentIndex, question: session.question })
  }, [session, feedback, shown])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  // Sends one answer. `key` names the thing the child tapped (for the
  // feedback visuals); `origin` is where the celebration bursts from.
  const submit = useCallback(
    async (answer: unknown, key: string, origin?: HTMLElement | null): Promise<KidsAnswerResult | null> => {
      if (!shown || answering || feedback) return null
      setAnswering(true)
      setSubmitError(null)
      try {
        const res = await fetch(`/api/gameroom-v2/sessions/${sessionId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionIndex: shown.index, answer }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || typeof data?.isCorrect !== 'boolean') throw new Error(data?.error || 'Could not check that answer')
        const revealed = typeof data.correctAnswer === 'string' ? data.correctAnswer : null

        if (data.isCorrect) {
          const nextStreak = streak + 1
          const words = PRAISE[Math.floor(Math.random() * PRAISE.length)]
          setPraise(words)
          setStreak(nextStreak)
          setStars((s) => s + 1)
          setFeedback({ kind: 'correct', key })
          const r = origin?.getBoundingClientRect()
          fx.current?.correct({ streak: nextStreak, origin: r ? { x: r.left + r.width / 2, y: r.top + r.height / 3 } : undefined, card: false })
        } else {
          setStreak(0)
          // A soft sound, not a buzzer -- these are 4-year-olds
          playSound('button', soundEnabled)
          setFeedback({ kind: 'wrong', key, revealed })
        }
        timer.current = window.setTimeout(
          () => {
            setFeedback(null)
            poll()
          },
          data.isCorrect ? feedbackMs.correct : feedbackMs.wrong
        )
        return { isCorrect: data.isCorrect, revealed }
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'Could not check that answer')
        poll()
        return null
      } finally {
        setAnswering(false)
      }
    },
    [shown, answering, feedback, sessionId, streak, soundEnabled, poll, feedbackMs.correct, feedbackMs.wrong]
  )

  return {
    started,
    start: () => setStarted(true),
    session,
    error,
    result,
    poll,
    exit,
    shown,
    feedback,
    answering,
    submitError,
    stars,
    praise,
    soundEnabled,
    toggleSound,
    reduced,
    fx,
    submit,
  }
}
