'use client'

// No sound-effect infrastructure existed anywhere in this app before
// this -- a tiny native-Audio-API helper, deliberately minimal. Used by
// the two Uyir Ezhuthukkal interactive games; sound is enhancement-only
// and must never block or break gameplay if a browser blocks autoplay or
// a file fails to load.
//
// Confirmed as a real bug: this app is mounted at
// tamilschoolfl.org/tamizhi via basePath (see next.config.mjs). Next.js
// auto-prefixes basePath onto _next/static and next/link/next/image, but
// a plain string handed to `new Audio(...)` is NOT auto-prefixed -- in
// production this silently requested tamilschoolfl.org/sounds/... (a
// 404, no /tamizhi) instead of the real asset, so every sound played as
// a no-op with no visible error. Hardcoded here for the same reason
// fetch('/api/...') calls elsewhere need the Cloudflare Worker's help --
// there is no such forwarding for static public/ assets, so the client
// must include the prefix itself.
const BASE_PATH = '/tamizhi'

const SOUND_FILES = {
  correct: `${BASE_PATH}/sounds/correct.wav`,
  incorrect: `${BASE_PATH}/sounds/incorrect.wav`,
  complete: `${BASE_PATH}/sounds/complete.wav`,
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
