'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PLAYER_HEADER } from '@/lib/grClassic/live'
import { grcApi } from '../teacher/api'

// Asks the server for the latest live-game state every `ms` milliseconds
// (slower while the tab is hidden). Keeps showing the last good state if a
// request fails, and reports "reconnecting" instead -- so a Wi-Fi blip just
// pauses the screen rather than breaking the game.
//
// Only one request is ever in flight: a refresh() during a request runs
// straight after it instead of starting a second loop. (Two loops would
// multiply with every refresh and their replies could land out of order,
// making the screen jump back and forth between old and new states.)
//
// `offset` = server clock minus this device's clock, so countdowns match
// the server's timer even if the phone's clock is wrong.
// `playerId` (students only) = the account this tab joined the game with.
export function usePoll<T extends { serverNow?: string }>(path: string | null, ms: number, playerId?: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<{ message: string; status: number; code?: string } | null>(null)
  const [offset, setOffset] = useState(0)
  const wake = useRef<() => void>(() => {})
  // When the page puts in newer state itself (the reply to a button press),
  // a status check that left before that moment is older -- ignore it.
  const putAt = useRef(0)

  useEffect(() => {
    if (!path) return
    let stopped = false
    let inFlight = false
    let again = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      if (inFlight) {
        again = true
        return
      }
      clearTimeout(timer)
      inFlight = true
      const sent = Date.now()
      const res = await grcApi<T>(path, playerId ? { headers: { [PLAYER_HEADER]: playerId } } : undefined)
      inFlight = false
      if (stopped) return
      if (res.ok) {
        if (sent >= putAt.current) setData(res.data)
        setError(null)
        if (res.data.serverNow) setOffset(new Date(res.data.serverNow).getTime() - (sent + Date.now()) / 2)
      } else setError({ message: res.error, status: res.status, code: res.code })
      if (again) {
        again = false
        tick()
        return
      }
      timer = setTimeout(tick, typeof document !== 'undefined' && document.hidden ? ms * 3 : ms)
    }
    wake.current = tick
    tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [path, ms, playerId])

  // Fetch again right now (e.g. straight after the teacher presses Next).
  const refresh = useCallback(() => wake.current(), [])
  const put = useCallback((d: T) => {
    putAt.current = Date.now()
    setData(d)
  }, [])
  return { data, setData: put, error, offset, refresh }
}

// Seconds left until `endsAt` on the server's clock, ticking 4x a second.
export function useServerCountdown(endsAt: string | null | undefined, offset: number): number | null {
  const calc = useCallback(() => (endsAt ? Math.max(0, (new Date(endsAt).getTime() - (Date.now() + offset)) / 1000) : null), [endsAt, offset])
  const [left, setLeft] = useState(calc)
  useEffect(() => {
    setLeft(calc())
    if (!endsAt) return
    const t = setInterval(() => setLeft(calc()), 250)
    return () => clearInterval(t)
  }, [endsAt, calc])
  return left
}
