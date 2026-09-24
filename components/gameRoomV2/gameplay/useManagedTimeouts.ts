'use client'

import { useCallback, useEffect, useRef } from 'react'

// A setTimeout that is automatically cleared when the component
// unmounts. Engines schedule many short one-shot timers (hit flashes,
// impact bursts) from inside their simulation ticks; with plain
// window.setTimeout those kept firing after the student exited the game,
// calling setState on a torn-down component. Returns a stable
// `schedule(fn, ms)`.
export function useManagedTimeouts() {
  const handles = useRef(new Set<number>())

  useEffect(() => {
    const set = handles.current
    return () => {
      set.forEach((h) => window.clearTimeout(h))
      set.clear()
    }
  }, [])

  return useCallback((fn: () => void, ms: number) => {
    const handle = window.setTimeout(() => {
      handles.current.delete(handle)
      fn()
    }, ms)
    handles.current.add(handle)
  }, [])
}
