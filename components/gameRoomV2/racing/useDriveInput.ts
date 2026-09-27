'use client'

import { useCallback, useEffect, useRef } from 'react'

// Shared, mutable control state for the race: keyboard and touch both
// write into it, the simulation loop reads it every step. Kept in a ref
// (never React state) so holding a key never re-renders anything.
export interface ControlState {
  keys: Set<string>
  // Touch: analog steering (-1..1) and held pedals.
  touchSteer: number
  touchGas: boolean
  touchBrake: boolean
  // One-shot requests, consumed by the loop.
  boostRequested: boolean
  recoverRequested: boolean
}

export function emptyControls(): ControlState {
  return { keys: new Set(), touchSteer: 0, touchGas: false, touchBrake: false, boostRequested: false, recoverRequested: false }
}

export function readControls(c: ControlState): { throttle: number; brake: number; steer: number } {
  const k = c.keys
  const left = k.has('arrowleft') || k.has('a')
  const right = k.has('arrowright') || k.has('d')
  const keySteer = (right ? 1 : 0) - (left ? 1 : 0)
  const steer = Math.max(-1, Math.min(1, keySteer + c.touchSteer))
  const throttle = k.has('arrowup') || k.has('w') || c.touchGas ? 1 : 0
  const brake = k.has('arrowdown') || k.has('s') || c.touchBrake ? 1 : 0
  return { throttle, brake, steer }
}

const DRIVE_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'])

// Keyboard: arrows / WASD drive, Space boosts, R recovers, Escape (or P)
// pauses. Clears every held control on blur / tab switch so nothing
// ever gets stuck "on".
export function useDriveKeyboard({
  controls,
  enabled,
  onPause,
}: {
  controls: React.MutableRefObject<ControlState>
  enabled: boolean
  onPause: () => void
}) {
  const pauseRef = useRef(onPause)
  pauseRef.current = onPause
  const clear = useCallback(() => {
    const c = controls.current
    c.keys.clear()
    c.touchGas = false
    c.touchBrake = false
    c.touchSteer = 0
  }, [controls])

  useEffect(() => {
    if (!enabled) {
      clear()
      return
    }
    const isField = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement
    const down = (e: KeyboardEvent) => {
      if (isField(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'escape' || key === 'p') {
        e.preventDefault()
        pauseRef.current()
        return
      }
      if (DRIVE_KEYS.has(key)) {
        // A focused answer button must not steal arrow/space presses.
        e.preventDefault()
        controls.current.keys.add(key)
      } else if (key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) controls.current.boostRequested = true
      } else if (key === 'r' && !e.repeat) {
        controls.current.recoverRequested = true
      }
    }
    const up = (e: KeyboardEvent) => controls.current.keys.delete(e.key.toLowerCase())
    const vis = () => {
      if (document.hidden) clear()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', vis)
      clear()
    }
  }, [enabled, controls, clear])

  return clear
}
