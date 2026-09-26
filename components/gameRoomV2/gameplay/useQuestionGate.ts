'use client'

import { useEffect, useRef } from 'react'
import type { BaseSessionStatePayload } from '@/lib/gameRoomV2/gameplay/sessionPolling'

// For engines where questions appear at chosen moments (between waves,
// before an attack...) rather than back-to-back: keeps the SERVER's
// per-question clock honest by pausing the session whenever no question is
// on screen, and resuming it only when the game wants the next question.
//
// This reuses the existing secure pause/resume routes: while PAUSED the
// server does not return the question at all (no peeking during combat),
// and resume shifts the question's start time forward by the pause, so a
// student is never timed out -- or granted a speed bonus -- for time spent
// playing the game itself. Grading, points and rewards stay entirely
// server-side.
export function useQuestionGate({
  sessionId,
  state,
  wantQuestion,
  poll,
  enabled = true,
}: {
  sessionId: string
  state: BaseSessionStatePayload | null
  wantQuestion: boolean
  poll: () => Promise<void> | void
  enabled?: boolean
}): { questionReady: boolean; switching: boolean } {
  const inFlight = useRef(false)
  const status = state?.status

  useEffect(() => {
    if (!enabled || !status || inFlight.current) return
    let action: 'pause' | 'resume' | null = null
    if (wantQuestion && status === 'PAUSED') action = 'resume'
    if (!wantQuestion && status === 'ACTIVE') action = 'pause'
    if (!action) return
    inFlight.current = true
    fetch(`/api/gameroom-v2/sessions/${sessionId}/${action}`, { method: 'POST' })
      .catch(() => {
        // Next poll re-evaluates; a transient failure just retries.
      })
      .finally(async () => {
        await poll()
        inFlight.current = false
      })
  }, [enabled, status, wantQuestion, sessionId, poll])

  const questionReady = Boolean(wantQuestion && state?.status === 'ACTIVE' && (state as { question?: unknown } | null)?.question)
  const switching = Boolean(enabled && ((wantQuestion && status === 'PAUSED') || (!wantQuestion && status === 'ACTIVE')))
  return { questionReady, switching }
}
