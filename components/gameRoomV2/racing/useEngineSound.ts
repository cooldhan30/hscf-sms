'use client'

import { useEffect, type MutableRefObject } from 'react'
import { getAudioContext } from '@/components/gameRoomV2/gameplay/playSound'
import { player, type DriveState } from '@/lib/gameRoomV2/racing/drive'

// A quiet, generated engine note (two detuned oscillators through a
// low-pass filter) whose pitch follows the player's speed and rises
// while boosting. Only runs while `active` (racing, not paused) and
// sound is on; torn down completely otherwise. No audio files.
export function useEngineSound(stateRef: MutableRefObject<DriveState | null>, active: boolean, enabled: boolean) {
  useEffect(() => {
    if (!active || !enabled) return
    const ctx = getAudioContext()
    if (!ctx) return
    const master = ctx.createGain()
    master.gain.value = 0
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 700
    const a = ctx.createOscillator()
    const b = ctx.createOscillator()
    a.type = 'sawtooth'
    b.type = 'square'
    a.connect(filter)
    b.connect(filter)
    filter.connect(master)
    master.connect(ctx.destination)
    a.start()
    b.start()
    master.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.4)
    const timer = window.setInterval(() => {
      const s = stateRef.current
      if (!s) return
      const me = player(s)
      const f = Math.min(1.4, Math.abs(me.speed) / 430)
      const boost = s.boosting || me.boostT > 0 ? 1.18 : 1
      const base = (48 + f * 95) * boost
      a.frequency.setTargetAtTime(base, ctx.currentTime, 0.08)
      b.frequency.setTargetAtTime(base * 0.502, ctx.currentTime, 0.08)
      filter.frequency.setTargetAtTime(500 + f * 900, ctx.currentTime, 0.1)
      master.gain.setTargetAtTime(s.timeScale < 1 ? 0.012 : 0.02 + f * 0.022, ctx.currentTime, 0.15)
    }, 80)
    return () => {
      window.clearInterval(timer)
      const t = ctx.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setTargetAtTime(0, t, 0.05)
      window.setTimeout(() => {
        try {
          a.stop()
          b.stop()
        } catch {
          // already stopped
        }
        master.disconnect()
      }, 200)
    }
  }, [stateRef, active, enabled])
}
