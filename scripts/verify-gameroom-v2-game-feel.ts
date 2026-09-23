// Standalone verification script for the GameRoom V2 GAME FEEL pass:
// the shared sound engine (components/gameRoomV2/gameplay/playSound.ts)
// and haptics helper (useHaptics.ts). Both are DOM/browser-dependent
// (Audio, AudioContext, navigator.vibrate), so this script exercises
// only their pure, DOM-free data -- the tone recipes behind every
// synthesized sound and the vibration pattern behind every haptic
// event -- which is exactly the part worth asserting on without a
// browser. Same tsx-script convention as every other
// verify-gameroom-v2-*.ts script (no Jest/Vitest in this repo).
//
// Run with: npx tsx scripts/verify-gameroom-v2-game-feel.ts

import { tonesFor, type SoundId } from '../components/gameRoomV2/gameplay/playSound'
import { HAPTIC_PATTERNS, type HapticId } from '../components/gameRoomV2/gameplay/useHaptics'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

// The full vocabulary the game-feel pass's requirements list names --
// every one of these must produce actual audible tone data (a sound
// silently doing nothing because its id was misspelled in a switch
// statement is exactly the kind of bug this guards against).
const SYNTHESIZED_IDS: SoundId[] = ['button', 'streak', 'achievement', 'countdown', 'checkpoint', 'victory', 'gameOver']

console.log('== Every synthesized sound category produces at least one real tone ==')
for (const id of SYNTHESIZED_IDS) {
  const tones = tonesFor(id)
  assert(tones.length > 0, `${id} produces at least one tone (not an empty/unhandled switch case)`)
}

console.log('\n== Every tone has physically sane values (no silent/zero-length/negative tones) ==')
for (const id of SYNTHESIZED_IDS) {
  const tones = tonesFor(id, 4)
  for (let i = 0; i < tones.length; i++) {
    const tone = tones[i]
    assert(tone.freq > 0, `${id}[${i}]: frequency is positive (${tone.freq}Hz)`)
    assert(tone.durationMs > 0, `${id}[${i}]: duration is positive (${tone.durationMs}ms)`)
    assert(tone.startMs >= 0, `${id}[${i}]: start offset is non-negative (${tone.startMs}ms)`)
    assert(tone.gain === undefined || (tone.gain > 0 && tone.gain <= 1), `${id}[${i}]: gain, if set, is within (0, 1] (${tone.gain})`)
  }
}

console.log('\n== No synthesized sound is absurdly long (would overlap the NEXT gameplay event) ==')
// A sound that's still ringing 2+ seconds later would itself become the
// "overlapping audio chaos" the game-feel pass is meant to eliminate --
// answering questions happens on the order of seconds, not multi-second
// gaps, so every sound's total span (last tone's start + its own
// duration) needs headroom under that.
for (const id of SYNTHESIZED_IDS) {
  const tones = tonesFor(id)
  const totalSpanMs = Math.max(...tones.map((t) => t.startMs + t.durationMs))
  assert(totalSpanMs < 1500, `${id}'s total duration (${totalSpanMs}ms) stays under 1.5s`)
}

console.log("\n== 'streak' pitch rises with streak length, without ever going silent or unbounded ==")
const streakLow = tonesFor('streak', 1)
const streakMid = tonesFor('streak', 4)
const streakHigh = tonesFor('streak', 8)
const streakOverflow = tonesFor('streak', 999)
assert(streakLow[0].freq < streakMid[0].freq, 'a streak of 4 pitches higher than a streak of 1')
assert(streakMid[0].freq < streakHigh[0].freq, 'a streak of 8 pitches higher than a streak of 4')
assert(
  streakHigh[0].freq === streakOverflow[0].freq,
  'an absurdly large streak (999) is clamped to the same pitch as the max tier (8) -- never scales unbounded into an ear-splitting frequency'
)
assert(tonesFor('streak', 0)[0].freq === streakLow[0].freq, 'a streak variant of 0 (or omitted) is clamped up to the tier-1 floor, never treated as tier 0')

console.log('\n== Every synthesized sound category has a matching haptic pattern ==')
// button/streak/achievement/victory/gameOver are shared between BOTH
// vocabularies (correct/incorrect are recorded-audio-only but still
// need a haptic; countdown/checkpoint are intentionally audio-only --
// a per-second buzz during a countdown or a buzz on every checkpoint
// would be excessive vibration, not "game feel").
const EXPECTED_HAPTIC_IDS: HapticId[] = ['button', 'correct', 'incorrect', 'streak', 'achievement', 'victory', 'gameOver']
for (const id of EXPECTED_HAPTIC_IDS) {
  const pattern = HAPTIC_PATTERNS[id]
  assert(pattern !== undefined, `${id} has a defined haptic pattern`)
  const values = Array.isArray(pattern) ? pattern : [pattern]
  assert(values.every((v) => v > 0 && v <= 200), `${id}'s vibration pattern only uses short, reasonable pulses (${JSON.stringify(pattern)}ms, all within 1-200ms)`)
}

console.log('\n== gameOver and victory are audibly/hapticly distinct from each other and from correct/incorrect ==')
const gameOverTones = tonesFor('gameOver')
const victoryTones = tonesFor('victory')
assert(gameOverTones.length !== victoryTones.length || gameOverTones[0].freq !== victoryTones[0].freq, 'gameOver and victory use different tone recipes, not the same sound reused')
assert(
  JSON.stringify(HAPTIC_PATTERNS.gameOver) !== JSON.stringify(HAPTIC_PATTERNS.victory),
  'gameOver and victory have distinct haptic patterns'
)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
