'use client'

// No sound-effect infrastructure existed anywhere in this app before
// this -- a tiny native-Audio-API helper, deliberately minimal. Used by
// the two Uyir Ezhuthukkal interactive games; sound is enhancement-only
// and must never block or break gameplay if a browser blocks autoplay or
// a file fails to load.
const SOUND_FILES = {
  correct: '/sounds/correct.wav',
  incorrect: '/sounds/incorrect.wav',
  complete: '/sounds/complete.wav',
} as const

export type SoundId = keyof typeof SOUND_FILES

export function playSound(id: SoundId) {
  try {
    const audio = new Audio(SOUND_FILES[id])
    audio.volume = 0.5
    audio.play().catch(() => {
      // Autoplay can be blocked before any user gesture -- harmless, the
      // game keeps working with no sound.
    })
  } catch {
    // Never let a missing/broken audio file break gameplay.
  }
}
