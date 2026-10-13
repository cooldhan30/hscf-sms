'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { grcApi } from '../teacher/api'

// Asks the server for the latest live-game state every `ms` milliseconds
// (slower while the tab is hidden). Keeps showing the last good state if a
// request fails, and reports "reconnecting" instead -- so a Wi-Fi blip just
// pauses the screen rather than breaking the game.
//
// `offset` = server clock minus this device's clock, so countdowns match
// the server's timer even if the phone's clock is wrong.
export function usePoll<T extends { serverNow?: string }>(path: string | null, ms: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<{ message: string; status: number } | null>(null)
  const [offset, setOffset] = useState(0)
  const wake = useRef<() => void>(() => {})

  useEffect(() => {
    if (!path) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      clearTimeout(timer)
      const sent = Date.now()
      const res = await grcApi<T>(path)
      if (stopped) return
      if (res.ok) {
        setData(res.data)
        setError(null)
        if (res.data.serverNow) setOffset(new Date(res.data.serverNow).getTime() - (sent + Date.now()) / 2)
      } else setError({ message: res.error, status: res.status })
      timer = setTimeout(tick, typeof document !== 'undefined' && document.hidden ? ms * 3 : ms)
    }
    wake.current = tick
    tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [path, ms])

  // Fetch again right now (e.g. straight after the teacher presses Next).
  const refresh = useCallback(() => wake.current(), [])
  return { data, setData, error, offset, refresh }
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
