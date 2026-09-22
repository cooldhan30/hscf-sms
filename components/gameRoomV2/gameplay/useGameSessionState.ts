'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { playSound } from './playSound'
import {
  buildGameResult,
  pauseToggleEndpoint,
  shouldAbandonOnExit,
  type BaseSessionStatePayload,
  type CompletePayload,
} from '@/lib/gameRoomV2/gameplay/sessionPolling'
import type { GameResult } from '@/lib/gameRoomV2/domain'

const POLL_INTERVAL_MS = 2000

// THE shared session lifecycle hook: polling /state every 2s,
// completing exactly once when the server reports COMPLETED (playing
// the completion sound and fetching the full Results payload from
// /complete), and pause/resume/exit against the session API routes.
// Every GameRoom V2 engine's top-level play screen -- GameSessionRuntime
// itself plus Tower Defense/Racing/Boss Battle/Treasure Quest/Word
// Ninja, which each used to reimplement this exact block around their
// own visual frame -- now calls this one hook instead. Each engine still
// owns 100% of its own visual simulation (battlefield ticks, race
// physics, boss phases, room state, word flight); only the
// invisible network/lifecycle bookkeeping lives here.
//
// `enabled` gates the poll loop so engines that show a setup picker
// before a session concept exists (difficulty/theme/boss selection)
// can defer polling until the player has made that choice, exactly as
// each engine's own `if (!difficulty) return` effect guard did before.
export function useGameSessionState<TState extends BaseSessionStatePayload>({
  sessionId,
  enabled = true,
  soundEnabled,
  onCompleted,
}: {
  sessionId: string
  enabled?: boolean
  soundEnabled: boolean
  /** Optional side effect to run once, the moment COMPLETED is first observed (e.g. an engine-specific victory animation trigger). */
  onCompleted?: () => void
}) {
  const [state, setState] = useState<TState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [pausing, setPausing] = useState(false)
  const completedSoundPlayedRef = useRef(false)
  const onCompletedFiredRef = useRef(false)

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/gameroom-v2/sessions/${sessionId}/state`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        setError(data?.error || 'Lost connection to the game')
        return
      }
      setError(null)
      setState(data)
    } catch {
      setError('Lost connection -- retrying...')
    }
  }, [sessionId])

  useEffect(() => {
    if (!enabled) return
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [poll, enabled])

  // Fires exactly once, the first time /state reports COMPLETED --
  // `result` being set thereafter prevents this from re-firing on
  // subsequent polls (see complete/route.ts's own idempotency
  // guarantee, which this relies on rather than duplicating).
  useEffect(() => {
    if (state?.status !== 'COMPLETED' || result) return

    if (!completedSoundPlayedRef.current) {
      completedSoundPlayedRef.current = true
      playSound('complete', soundEnabled)
    }
    if (!onCompletedFiredRef.current) {
      onCompletedFiredRef.current = true
      onCompleted?.()
    }

    fetch(`/api/gameroom-v2/sessions/${sessionId}/complete`, { method: 'POST' })
      .then((res) => res.json())
      .then((data: CompletePayload & { error?: string }) => {
        if (data.error) {
          setError(data.error)
          return
        }
        setResult(buildGameResult(data))
      })
      .catch(() => setError('Failed to load your results'))
  }, [state?.status, result, sessionId, soundEnabled, onCompleted])

  const togglePause = useCallback(async () => {
    if (!state) return
    setPausing(true)
    const endpoint = pauseToggleEndpoint(state.status)
    await fetch(`/api/gameroom-v2/sessions/${sessionId}/${endpoint}`, { method: 'POST' })
    setPausing(false)
    poll()
  }, [state, sessionId, poll])

  const exit = useCallback(
    async (onExit: () => void) => {
      if (shouldAbandonOnExit(state?.status)) {
        await fetch(`/api/gameroom-v2/sessions/${sessionId}/abandon`, { method: 'POST' })
      }
      onExit()
    },
    [state?.status, sessionId]
  )

  return { state, error, result, pausing, poll, togglePause, exit }
}
