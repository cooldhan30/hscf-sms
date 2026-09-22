'use client'

// Forked playback logic from lib/gameRoom/sound.ts rather than
// imported -- same isolation rationale as lib/gameRoomV2/shuffle.ts.
// Reuses the SAME three static sound files at public/sounds/*.wav
// (correct/incorrect/complete) since those are binary assets, not
// code -- duplicating the actual .wav files would be pure waste with
// zero isolation benefit; only the TypeScript playback function is
// forked. Callers pass their own soundEnabled flag (from
// useSoundPreference()) so muting is enforced at the call site, not
// hidden inside this helper.
//
// The basePath quirk documented in the original still applies: this
// app is mounted at tamilschoolfl.org/tamizhi, and a plain string
// handed to `new Audio(...)` is NOT auto-prefixed the way next/link or
// next/image are.
const BASE_PATH = '/tamizhi'

const SOUND_FILES = {
  correct: `${BASE_PATH}/sounds/correct.wav`,
  incorrect: `${BASE_PATH}/sounds/incorrect.wav`,
  complete: `${BASE_PATH}/sounds/complete.wav`,
} as const

export type SoundId = keyof typeof SOUND_FILES

export function playSound(id: SoundId, soundEnabled: boolean) {
  if (!soundEnabled) return
  try {
    const audio = new Audio(SOUND_FILES[id])
    audio.volume = 0.5
    audio.play().catch(() => {
      // Autoplay can be blocked before any user gesture -- harmless,
      // gameplay continues silently.
    })
  } catch {
    // Sound is enhancement-only -- never let a missing/broken file
    // break gameplay.
  }
}
