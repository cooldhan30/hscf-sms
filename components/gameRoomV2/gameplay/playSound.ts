'use client'

// THE shared GameRoom V2 sound engine. Two kinds of sound live here:
//
// 1. The three pre-existing recorded files (correct/incorrect/complete)
//    at public/sounds/*.wav -- unchanged, still played via
//    HTMLAudioElement exactly as before.
// 2. Everything else the "game feel" pass added (button/streak/
//    achievement/countdown/checkpoint/victory/gameOver) -- synthesized
//    at call time with the Web Audio API (a handful of oscillator +
//    gain nodes per sound) rather than shipping new binary assets. This
//    keeps the whole engine at zero added KB of audio and zero new
//    dependencies while still giving each event its own distinct,
//    game-appropriate timbre (a rising chime for streak, a triumphant
//    arpeggio for achievement, a descending minor tone for game over,
//    etc), which plain playbackRate tricks on 3 shared files can't do
//    without them all still sounding like the same source clip.
//
// Design goals from the game-feel audit:
// - ONE shared AudioContext, created lazily on first real playback
//   (never at module load / import time) -- browsers block audio
//   contexts from starting before a user gesture, so constructing one
//   eagerly would just log console warnings for nothing.
// - Per-category exclusivity: playing a new sound in the same category
//   (e.g. two "correct" sounds fired 50ms apart because of a fast
//   double-answer race) stops the previous instance of THAT category
//   first, so sounds never stack into overlapping chaos. Different
//   categories (e.g. a button click while a streak chime is playing)
//   are allowed to overlap, since that's normal, expected layering, not
//   chaos.
// - Every playback is muted at the call site (soundEnabled), never
//   inside a fire-and-forget promise a caller can't observe.
// - `stopAllSounds()` gives every engine one cheap, synchronous way to
//   silence everything on unmount/exit -- no dangling oscillators or
//   audio elements left running after a student leaves a game screen.

const BASE_PATH = '/tamizhi'

const RECORDED_SOUND_FILES = {
  correct: `${BASE_PATH}/sounds/correct.wav`,
  incorrect: `${BASE_PATH}/sounds/incorrect.wav`,
  complete: `${BASE_PATH}/sounds/complete.wav`,
} as const

type RecordedSoundId = keyof typeof RECORDED_SOUND_FILES

// The full GameRoom V2 sound vocabulary -- every category the game-feel
// pass's requirements list names, plus `complete` kept as an alias for
// backward compatibility with the ~20 existing call sites across every
// engine (all of which mean "the session as a whole finished," i.e.
// today's generic completion chime; `victory`/`gameOver` are the new,
// more specific sibling events for engines that distinguish winning
// from losing).
export type SoundId =
  | RecordedSoundId
  | 'button'
  | 'streak'
  | 'achievement'
  | 'countdown'
  | 'checkpoint'
  | 'victory'
  | 'gameOver'
  // Game-event sounds (Tower Defense and other arcade engines).
  | 'coin'
  | 'build'
  | 'upgrade'
  | 'hit'
  | 'ability'
  | 'waveStart'
  | 'bossWarning'
  | 'baseHit'
  | 'slash'
  // Racing.
  | 'go'
  | 'boost'
  | 'overtake'
  | 'finalLap'
  | 'finish'
  | 'podium'

let audioCtx: AudioContext | null = null

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return null
  if (!audioCtx) {
    audioCtx = new AudioContextCtor()
  }
  // Mobile Safari/Chrome suspend the context until a user gesture
  // resumes it -- every playSound() call is already gated behind a
  // student action (answering, tapping a button, a game event firing
  // off the back of one), so resuming here is always inside that same
  // gesture chain, never a cold autoplay attempt.
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // Best-effort -- if resume is refused, the sound below simply
      // won't be audible, and gameplay continues silently.
    })
  }
  return audioCtx
}

// One active playback per category, so two "correct" sounds firing in
// quick succession (e.g. a fast poll + a local optimistic callback)
// cancel-and-restart instead of layering into noise, while a "button"
// click and a "streak" chime happening at the same moment are still
// allowed to sound together, since that's normal layered feedback.
const activeByCategory = new Map<SoundId, { stop: () => void }>()

function claimCategory(id: SoundId, handle: { stop: () => void }) {
  activeByCategory.get(id)?.stop()
  activeByCategory.set(id, handle)
}

// Stops every currently-playing GameRoom V2 sound immediately --
// recorded clips and synthesized oscillators alike. Every engine's
// top-level play component calls this on unmount (see the
// `useEffect(() => stopAllSounds, [])` pattern) so leaving a game mid-
// sound never leaves audio playing into the next screen.
export function stopAllSounds() {
  activeByCategory.forEach((handle) => handle.stop())
  activeByCategory.clear()
}

function playRecorded(id: RecordedSoundId) {
  try {
    const audio = new Audio(RECORDED_SOUND_FILES[id])
    audio.volume = 0.5
    claimCategory(id, { stop: () => audio.pause() })
    audio.play().catch(() => {
      // Autoplay can be blocked before any user gesture -- harmless,
      // gameplay continues silently.
    })
  } catch {
    // Sound is enhancement-only -- never let a missing/broken file
    // break gameplay.
  }
}

export interface Tone {
  freq: number
  startMs: number
  durationMs: number
  gain?: number
  type?: OscillatorType
}

// Plays a short sequence of tones as one logical sound. Each tone is
// its own oscillator + gain envelope (quick attack, exponential decay
// to avoid clicks) so multi-note sounds (achievement's arpeggio,
// victory's fanfare) are just a list of {freq, startMs, durationMs}
// rather than needing a synthesizer abstraction.
function playTones(id: SoundId, tones: Tone[]) {
  const ctx = getAudioContext()
  if (!ctx) return

  const nodes: { osc: OscillatorNode; gain: GainNode }[] = []
  const now = ctx.currentTime

  for (const tone of tones) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = tone.type ?? 'sine'
    osc.frequency.value = tone.freq
    osc.connect(gain)
    gain.connect(ctx.destination)

    const start = now + tone.startMs / 1000
    const duration = tone.durationMs / 1000
    const peakGain = tone.gain ?? 0.15

    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(peakGain, start + Math.min(0.015, duration / 4))
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

    osc.start(start)
    osc.stop(start + duration + 0.02)
    nodes.push({ osc, gain })
  }

  claimCategory(id, {
    stop: () => {
      nodes.forEach(({ osc }) => {
        try {
          osc.stop()
        } catch {
          // Already stopped -- a tone whose envelope already finished
          // naturally throws here, which is fine to ignore.
        }
      })
    },
  })
}

// One tone recipe per synthesized category -- kept as plain data next
// to playSound() itself so the whole sound vocabulary is readable/
// auditable in one place rather than scattered across call sites.
// Frequencies chosen by ear for a bright, kid-friendly arcade feel
// (major-key intervals for positive events, a minor third descent for
// the one negative event) rather than any formal music theory tooling.
// Exported (rather than kept module-private) so
// scripts/verify-gameroom-v2-game-feel.ts can assert on this pure data
// without needing a DOM/AudioContext -- the one part of this file that
// doesn't require a browser to exercise meaningfully.
export function tonesFor(id: SoundId, variant?: number): Tone[] {
  switch (id) {
    case 'button':
      // A single, very short, quiet tick -- meant to be heard dozens of
      // times a session without becoming annoying or drawing attention
      // away from the correct/incorrect sounds that actually matter.
      return [{ freq: 720, startMs: 0, durationMs: 45, gain: 0.06, type: 'square' }]
    case 'streak': {
      // Pitch rises with streak length (capped) so a 2-streak sounds
      // like a light blip and a 10+ streak sounds noticeably more
      // triumphant, without needing a distinct sound file per tier.
      const tier = Math.min(Math.max(variant ?? 1, 1), 8)
      const base = 520 + tier * 40
      return [
        { freq: base, startMs: 0, durationMs: 90, gain: 0.13, type: 'triangle' },
        { freq: base * 1.5, startMs: 70, durationMs: 110, gain: 0.13, type: 'triangle' },
      ]
    }
    case 'achievement':
      // A bright three-note major arpeggio -- the one sound in the
      // vocabulary meant to feel like a genuine "unlock" moment.
      return [
        { freq: 523.25, startMs: 0, durationMs: 130, gain: 0.16 },
        { freq: 659.25, startMs: 110, durationMs: 130, gain: 0.16 },
        { freq: 783.99, startMs: 220, durationMs: 260, gain: 0.18 },
      ]
    case 'countdown':
      // A short, neutral tick -- sharper/higher than `button` so it
      // reads as urgent, meant to be called once per second in a
      // final countdown, not layered with itself.
      return [{ freq: 880, startMs: 0, durationMs: 70, gain: 0.11, type: 'square' }]
    case 'checkpoint':
      // A soft two-note rising sweep for "you've reached a milestone,
      // keep going" -- gentler than achievement, since a checkpoint is
      // progress, not a finished accomplishment.
      return [
        { freq: 440, startMs: 0, durationMs: 90, gain: 0.12, type: 'triangle' },
        { freq: 587.33, startMs: 80, durationMs: 160, gain: 0.13, type: 'triangle' },
      ]
    case 'victory':
      // A four-note major fanfare -- the biggest, longest sound in the
      // vocabulary, reserved for "you won," distinct from the generic
      // `complete` chime every engine already fires for "session over."
      return [
        { freq: 523.25, startMs: 0, durationMs: 140, gain: 0.17 },
        { freq: 659.25, startMs: 120, durationMs: 140, gain: 0.17 },
        { freq: 783.99, startMs: 240, durationMs: 140, gain: 0.17 },
        { freq: 1046.5, startMs: 360, durationMs: 360, gain: 0.2 },
      ]
    case 'gameOver':
      // A two-note minor-third descent -- deliberately gentle (no harsh
      // buzzer) since this plays for kids, but clearly distinct in mood
      // from `incorrect` (a single wrong answer) and from `victory`.
      return [
        { freq: 392, startMs: 0, durationMs: 220, gain: 0.15, type: 'triangle' },
        { freq: 293.66, startMs: 180, durationMs: 380, gain: 0.15, type: 'triangle' },
      ]
    case 'coin':
      // A tiny bright double-blip -- pickups happen often, so it's short and quiet.
      return [
        { freq: 988, startMs: 0, durationMs: 50, gain: 0.07, type: 'square' },
        { freq: 1319, startMs: 45, durationMs: 70, gain: 0.07, type: 'square' },
      ]
    case 'build':
      return [
        { freq: 330, startMs: 0, durationMs: 70, gain: 0.12, type: 'triangle' },
        { freq: 440, startMs: 60, durationMs: 110, gain: 0.12, type: 'triangle' },
      ]
    case 'upgrade':
      return [
        { freq: 523.25, startMs: 0, durationMs: 80, gain: 0.12, type: 'triangle' },
        { freq: 659.25, startMs: 70, durationMs: 80, gain: 0.12, type: 'triangle' },
        { freq: 1046.5, startMs: 140, durationMs: 160, gain: 0.13, type: 'triangle' },
      ]
    case 'hit':
      // Very short, very quiet thud -- rate-limited in playSound().
      return [{ freq: 180, startMs: 0, durationMs: 40, gain: 0.05, type: 'square' }]
    case 'ability':
      return [
        { freq: 392, startMs: 0, durationMs: 120, gain: 0.14, type: 'sawtooth' },
        { freq: 784, startMs: 90, durationMs: 220, gain: 0.12, type: 'triangle' },
      ]
    case 'waveStart':
      return [
        { freq: 294, startMs: 0, durationMs: 150, gain: 0.13, type: 'triangle' },
        { freq: 392, startMs: 140, durationMs: 220, gain: 0.14, type: 'triangle' },
      ]
    case 'bossWarning':
      // Low, ominous (but not scary) three-pulse horn.
      return [
        { freq: 146.83, startMs: 0, durationMs: 220, gain: 0.16, type: 'sawtooth' },
        { freq: 146.83, startMs: 300, durationMs: 220, gain: 0.16, type: 'sawtooth' },
        { freq: 110, startMs: 600, durationMs: 420, gain: 0.17, type: 'sawtooth' },
      ]
    case 'baseHit':
      return [{ freq: 110, startMs: 0, durationMs: 160, gain: 0.14, type: 'triangle' }]
    case 'go':
      return [
        { freq: 880, startMs: 0, durationMs: 120, gain: 0.16, type: 'square' },
        { freq: 1318.5, startMs: 0, durationMs: 380, gain: 0.14, type: 'triangle' },
      ]
    case 'boost':
      return [
        { freq: 220, startMs: 0, durationMs: 160, gain: 0.12, type: 'sawtooth' },
        { freq: 440, startMs: 90, durationMs: 180, gain: 0.11, type: 'sawtooth' },
        { freq: 660, startMs: 180, durationMs: 220, gain: 0.1, type: 'triangle' },
      ]
    case 'overtake':
      return [
        { freq: 659.25, startMs: 0, durationMs: 80, gain: 0.12, type: 'triangle' },
        { freq: 987.77, startMs: 70, durationMs: 140, gain: 0.12, type: 'triangle' },
      ]
    case 'finalLap':
      return [
        { freq: 523.25, startMs: 0, durationMs: 110, gain: 0.14, type: 'square' },
        { freq: 523.25, startMs: 150, durationMs: 110, gain: 0.14, type: 'square' },
        { freq: 783.99, startMs: 300, durationMs: 320, gain: 0.15, type: 'triangle' },
      ]
    case 'finish':
      return [
        { freq: 392, startMs: 0, durationMs: 120, gain: 0.15 },
        { freq: 523.25, startMs: 110, durationMs: 120, gain: 0.15 },
        { freq: 659.25, startMs: 220, durationMs: 120, gain: 0.15 },
        { freq: 783.99, startMs: 330, durationMs: 420, gain: 0.17 },
      ]
    case 'podium':
      return [
        { freq: 523.25, startMs: 0, durationMs: 160, gain: 0.15, type: 'triangle' },
        { freq: 659.25, startMs: 0, durationMs: 160, gain: 0.12, type: 'triangle' },
        { freq: 783.99, startMs: 180, durationMs: 160, gain: 0.15, type: 'triangle' },
        { freq: 1046.5, startMs: 360, durationMs: 520, gain: 0.17, type: 'triangle' },
      ]
    case 'slash':
      // A quick bright swish -- two very short descending blips.
      return [
        { freq: 1480, startMs: 0, durationMs: 35, gain: 0.06, type: 'sawtooth' },
        { freq: 880, startMs: 30, durationMs: 45, gain: 0.05, type: 'triangle' },
      ]
    default:
      return []
  }
}

// Minimum gap between two plays of the same frequent game-event sound,
// so a tower firing 3x a second or ten coins dropping at once never
// turns into noise.
const MIN_GAP_MS: Partial<Record<SoundId, number>> = { hit: 140, coin: 90, baseHit: 250, build: 80, slash: 60 }
const lastPlayedAt = new Map<SoundId, number>()

// `variant` is an optional intensity knob a caller can pass for sounds
// that scale with a number (currently just `streak`, keyed off the
// player's current streak length) -- ignored by every other category.
export function playSound(id: SoundId, soundEnabled: boolean, variant?: number) {
  if (!soundEnabled) return
  const gap = MIN_GAP_MS[id]
  if (gap !== undefined) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (now - (lastPlayedAt.get(id) ?? -Infinity) < gap) return
    lastPlayedAt.set(id, now)
  }

  if (id in RECORDED_SOUND_FILES) {
    playRecorded(id as RecordedSoundId)
    return
  }

  playTones(id, tonesFor(id, variant))
}
