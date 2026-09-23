'use client'

import { useCallback } from 'react'
import { useSoundPreference } from './useSoundPreference'

// A short vibration pattern per event -- deliberately reuses the SAME
// on/off preference as sound (useSoundPreference) rather than adding a
// second toggle: from a student's point of view "mute" means "stop
// buzzing my device too," not just "stop the audio." navigator.vibrate
// is standard-but-optional (desktop browsers and iOS Safari don't
// implement it at all) -- every call site already treats sound as
// enhancement-only, so this follows the same rule: never throws, never
// blocks, silently does nothing where unsupported.
// Exported for scripts/verify-gameroom-v2-game-feel.ts -- a pure data
// map is the one part of this file worth asserting on without a real
// navigator.vibrate implementation.
export const HAPTIC_PATTERNS: Record<HapticId, number | number[]> = {
  button: 8,
  correct: 15,
  incorrect: [20, 40, 20],
  streak: 12,
  achievement: [15, 30, 15, 30, 25],
  victory: [20, 40, 20, 40, 40],
  gameOver: [30, 60, 30],
}

export type HapticId = 'button' | 'correct' | 'incorrect' | 'streak' | 'achievement' | 'victory' | 'gameOver'

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

export function vibrate(id: HapticId, hapticsEnabled: boolean) {
  if (!hapticsEnabled || !canVibrate()) return
  try {
    navigator.vibrate(HAPTIC_PATTERNS[id])
  } catch {
    // Enhancement-only -- some browsers throw if called outside a user
    // gesture or with vibration disabled at the OS level.
  }
}

// Convenience hook pairing haptics to the same soundEnabled preference
// every engine already reads, so a component that wants "buzz on
// correct answer" doesn't need to separately wire useSoundPreference()
// itself just to get the mute flag.
export function useHaptics() {
  const { soundEnabled } = useSoundPreference()

  const fire = useCallback(
    (id: HapticId) => {
      vibrate(id, soundEnabled)
    },
    [soundEnabled]
  )

  return { fire, hapticsSupported: canVibrate() }
}
