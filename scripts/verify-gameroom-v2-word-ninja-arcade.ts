// Mechanics tests for Word Ninja's arcade layer
// (lib/gameRoomV2/wordNinja/arcade.ts): falling words, hearts, re-falls,
// combo, escalating speed, golden words, power-ups, the server verdict
// feeding back through judgeRound(), and bot-driven balance checks.
//
// Run with: npx tsx scripts/verify-gameroom-v2-word-ninja-arcade.ts

import {
  createNinja,
  beginRound,
  stepNinja,
  slash,
  frontWord,
  speedOf,
  canUsePower,
  firePower,
  roundSubmission,
  judgeRound,
  NINJA_TUNING,
  COMBO_FOR_CHARGE,
  MAX_POWER_CHARGES,
  STEP_MS_NINJA,
  WRONG_ROUND_HEARTS,
  type NinjaState,
  type NinjaEvent,
} from '../lib/gameRoomV2/wordNinja/arcade'
import { gradeAnswer } from '../lib/gameRoomV2/gradeAnswer'
import type { WordNinjaDifficulty } from '../lib/gameRoomV2/wordNinja/difficulty'

let failures = 0
let checks = 0
function assert(condition: boolean, message: string) {
  checks++
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

const ITEMS = ['அ', 'க', 'இ', 'ங', 'உ', 'ச']
const KEY: Record<string, string> = { அ: 'உயிர்', க: 'மெய்', இ: 'உயிர்', ங: 'மெய்', உ: 'உயிர்', ச: 'மெய்' }

function runUntil(s: NinjaState, pred: (s: NinjaState, ev: NinjaEvent[]) => boolean, maxMs = 120000): NinjaEvent[] {
  const all: NinjaEvent[] = []
  for (let t = 0; t < maxMs; t += STEP_MS_NINJA) {
    const ev = stepNinja(s)
    all.push(...ev)
    if (pred(s, ev)) break
  }
  return all
}

console.log('== Round start ==')
{
  const s = createNinja({ seed: 1, difficulty: 'normal' })
  assert(s.phase === 'idle' && s.lives === NINJA_TUNING.normal.lives, 'starts idle with full hearts')
  assert(!beginRound(s, []), 'a round with no items is refused')
  assert(beginRound(s, ITEMS), 'a round begins with the question\'s items')
  assert(s.phase === 'falling' && s.round === 1, 'phase is falling, round 1')
  assert([...s.queue].sort().join() === [...ITEMS].sort().join(), 'every item is queued exactly once')
  assert(s.goldenItem !== null && ITEMS.includes(s.goldenItem), 'one of the items is a golden word')
  assert(!beginRound(s, ITEMS), 'cannot begin a second round while one is running')
  const a = createNinja({ seed: 7, difficulty: 'normal' })
  const b = createNinja({ seed: 7, difficulty: 'normal' })
  beginRound(a, ITEMS)
  beginRound(b, ITEMS)
  assert(a.queue.join() === b.queue.join(), 'the same seed drops words in the same order (replayable, testable)')
}

console.log('\n== Falling, spawning and the airborne cap ==')
{
  const s = createNinja({ seed: 2, difficulty: 'hard' })
  beginRound(s, ITEMS)
  let maxAir = 0
  let spawned = 0
  runUntil(s, (st, ev) => {
    maxAir = Math.max(maxAir, st.air.length)
    spawned += ev.filter((e) => e.type === 'spawn').length
    return spawned >= 3
  })
  assert(spawned >= 3, 'words keep spawning while the queue has items')
  assert(maxAir <= NINJA_TUNING.hard.maxAirborne, `never more than ${NINJA_TUNING.hard.maxAirborne} words in the air`)
  const f = frontWord(s)
  assert(!!f && s.air.every((w) => w.y <= f.y), 'the front word is the one closest to the floor')
}

console.log('\n== A word that hits the floor costs a heart and falls again ==')
{
  const s = createNinja({ seed: 3, difficulty: 'normal' })
  beginRound(s, ['அ', 'க'])
  const ev = runUntil(s, (_st, e) => e.some((x) => x.type === 'miss'))
  const miss = ev.find((e) => e.type === 'miss') as Extract<NinjaEvent, { type: 'miss' }>
  assert(!!miss && !miss.shielded, 'an unslashed word lands and is reported as a miss')
  assert(s.lives === NINJA_TUNING.normal.lives - 1, 'the miss costs exactly one heart')
  assert(s.queue.includes(miss.item) || s.air.some((w) => w.item === miss.item), 'the missed word is not dropped: it will fall again')
  assert(s.combo === 0, 'a miss breaks the combo')
  assert(s.phase === 'falling', 'the round continues after a miss')
}

console.log('\n== Idle player: runs out of hearts ==')
{
  const s = createNinja({ seed: 4, difficulty: 'normal' })
  beginRound(s, ITEMS)
  const ev = runUntil(s, (st) => st.phase === 'over', 600000)
  assert(s.phase === 'over' && s.lives === 0, 'never slashing loses every heart -> game over')
  assert(ev.filter((e) => e.type === 'miss').length === NINJA_TUNING.normal.lives, 'exactly one heart per landed word')
  assert(stepNinja(s).length === 0 && slash(s, 'x').length === 0, 'nothing moves or slashes after game over')
}

console.log('\n== Slashing, combo and the submission ==')
{
  const s = createNinja({ seed: 5, difficulty: 'normal' })
  beginRound(s, ITEMS)
  let slashes = 0
  let firstPoints = 0
  let lastPoints = 0
  const all: NinjaEvent[] = []
  runUntil(s, (st) => {
    const w = frontWord(st)
    if (w && w.y > 0.15) {
      const ev = slash(st, KEY[w.item])
      all.push(...ev)
      const sl = ev.find((e) => e.type === 'slash') as Extract<NinjaEvent, { type: 'slash' }> | undefined
      if (sl) {
        slashes++
        if (slashes === 1) firstPoints = sl.golden ? sl.points / 3 : sl.points
        if (!sl.golden) lastPoints = sl.points
      }
    }
    return st.phase === 'judging'
  })
  assert(slashes === ITEMS.length, 'every word slashed once')
  assert(s.phase === 'judging', 'the round waits for the server verdict once every word has a lane')
  assert(all.some((e) => e.type === 'roundReady'), 'a roundReady event fires')
  assert(s.combo === ITEMS.length && s.stats.bestCombo === ITEMS.length, 'combo counts consecutive slashes')
  assert(lastPoints > firstPoints, 'the combo multiplier makes later slashes worth more')
  assert(s.stats.goldens === 1, 'the golden word was slashed')
  const sub = roundSubmission(s)
  assert(Object.keys(sub).length === ITEMS.length && ITEMS.every((i) => sub[i] === KEY[i]), 'the submission maps every item to its lane')
  assert(gradeAnswer('CATEGORIZE', { items: ITEMS, categories: ['உயிர்', 'மெய்'], answerKey: KEY }, sub) === true, 'the existing server grader accepts the arcade submission unchanged')
  assert(slash(s, 'உயிர்').length === 0, 'no slashing while the round is being judged')
}

console.log('\n== Height matters: an early slash scores more than a late one ==')
{
  const mk = () => {
    const s = createNinja({ seed: 9, difficulty: 'normal' })
    beginRound(s, ['அ', 'க'])
    s.goldenItem = null
    runUntil(s, (st) => st.air.length > 0)
    return s
  }
  const early = mk()
  early.air[0].y = 0.1
  const late = mk()
  late.air[0].y = 0.9
  const pe = (slash(early, 'x')[0] as Extract<NinjaEvent, { type: 'slash' }>).points
  const pl = (slash(late, 'x')[0] as Extract<NinjaEvent, { type: 'slash' }>).points
  assert(pe > pl, `slashing high (${pe}) beats slashing near the floor (${pl})`)
}

console.log('\n== Speed escalates with every slash (capped) ==')
{
  const s = createNinja({ seed: 10, difficulty: 'normal' })
  const v0 = speedOf(s)
  s.stats.slashed = 20
  const v1 = speedOf(s)
  s.stats.slashed = 10000
  assert(v1 > v0, `speed rises as the run goes on (${v0.toFixed(2)} -> ${v1.toFixed(2)})`)
  assert(speedOf(s) === NINJA_TUNING.normal.maxSpeed, 'speed is capped')
  assert(NINJA_TUNING.easy.fallMs > NINJA_TUNING.normal.fallMs && NINJA_TUNING.normal.fallMs > NINJA_TUNING.hard.fallMs, 'Hard falls faster than Normal, Normal faster than Easy')
  assert(NINJA_TUNING.easy.lives > NINJA_TUNING.hard.lives, 'Easy has more hearts than Hard')
  for (const t of Object.values(NINJA_TUNING)) {
    assert(!('categories' in t) && !('questionDifficulty' in t), 'difficulty never touches question content')
  }
}

console.log('\n== Power-ups ==')
{
  const s = createNinja({ seed: 11, difficulty: 'normal' })
  assert(s.charges.slow === 1 && s.charges.shield === 0, 'starts with one Slow Time charge')
  assert(!canUsePower(s, 'slow'), 'powers only work mid-round')
  beginRound(s, ITEMS)
  assert(canUsePower(s, 'slow') && !canUsePower(s, 'shield'), 'a power needs a charge')
  firePower(s, 'slow')
  assert(s.slowMs > 0 && s.charges.slow === 0, 'Slow Time consumes a charge and starts the slow')
  runUntil(s, (st) => st.air.length > 0)
  const y0 = s.air[0].y
  stepNinja(s)
  const slowDy = s.air[0].y - y0
  s.slowMs = 0
  const y1 = s.air[0].y
  stepNinja(s)
  const fastDy = s.air[0].y - y1
  assert(slowDy < fastDy * 0.6, 'words fall much slower during Slow Time')

  s.charges.shield = 1
  firePower(s, 'shield')
  assert(s.shield && !canUsePower(s, 'shield'), 'shield is up and cannot stack')
  const lives = s.lives
  const ev = runUntil(s, (_st, e) => e.some((x) => x.type === 'miss'))
  const miss = ev.find((e) => e.type === 'miss') as Extract<NinjaEvent, { type: 'miss' }>
  assert(miss.shielded && s.lives === lives && !s.shield, 'the shield absorbs one landed word without losing a heart')
  assert(s.queue[0] === miss.item || s.air.some((w) => w.item === miss.item), 'the blocked word is thrown back up to fall again')

  const c = createNinja({ seed: 12, difficulty: 'easy' })
  beginRound(c, Array.from({ length: 20 }, (_, i) => `w${i}`))
  c.goldenItem = null
  let charges = 0
  runUntil(c, (st) => {
    const w = frontWord(st)
    if (w) charges += slash(st, 'a').filter((e) => e.type === 'charge').length
    return st.phase === 'judging'
  })
  assert(charges === Math.floor(20 / COMBO_FOR_CHARGE), `a ${COMBO_FOR_CHARGE}-slash combo earns a power charge`)
  c.charges = { slow: MAX_POWER_CHARGES, shield: MAX_POWER_CHARGES }
  judgeRound(c, true)
  assert(c.charges.slow === MAX_POWER_CHARGES && c.charges.shield === MAX_POWER_CHARGES, `charges cap at ${MAX_POWER_CHARGES}`)
}

console.log('\n== The server verdict ==')
{
  const s = createNinja({ seed: 13, difficulty: 'normal' })
  const play = (correct: boolean) => {
    beginRound(s, ITEMS)
    runUntil(s, (st) => {
      if (frontWord(st)) slash(st, 'a')
      return st.phase === 'judging'
    })
    return judgeRound(s, correct)
  }
  const full = s.lives
  const score0 = s.score
  let ev = play(true)
  const j = ev.find((e) => e.type === 'judged') as Extract<NinjaEvent, { type: 'judged' }>
  assert(j.correct && j.bonus > 0 && s.score > score0, 'a clean round (server says correct) earns a bonus')
  assert(s.phase === 'idle', 'back to idle, waiting for the next question')
  ev = play(false)
  assert(s.lives === full - WRONG_ROUND_HEARTS && s.combo === 0, 'a round with a word in the wrong lane costs hearts and the combo')
  play(true)
  play(true)
  assert(s.lives === full - WRONG_ROUND_HEARTS + 1, 'two clean rounds in a row win a heart back')
  assert(judgeRound(s, true).length === 0, 'a verdict outside judging is ignored')
  s.lives = 1
  play(false)
  assert(s.phase === 'over', 'losing the last heart on a verdict ends the run')
}

console.log('\n== Balance (bot players) ==')
// A bot reads each word for `readMs` after it becomes the front word,
// then slashes it into the right lane with probability `accuracy`.
function botRun(difficulty: WordNinjaDifficulty, seed: number, accuracy: number, readMs: number, usesPowers: boolean, rounds = 3, perRound = 7) {
  const s = createNinja({ seed, difficulty })
  let rng = seed * 9301 + 49297
  const rand = () => ((rng = (rng * 9301 + 49297) % 233280) / 233280)
  for (let r = 0; r < rounds && s.phase !== 'over'; r++) {
    const items = Array.from({ length: perRound }, (_, i) => `r${r}w${i}`)
    beginRound(s, items)
    let wrong = false
    let frontId = -1
    let seenAt = 0
    for (let t = 0; t < 600000 && s.phase === 'falling'; t += STEP_MS_NINJA) {
      stepNinja(s)
      const f = frontWord(s)
      if (!f) continue
      if (f.id !== frontId) {
        frontId = f.id
        seenAt = s.timeMs
      }
      if (usesPowers && f.y > 0.7) {
        if (canUsePower(s, 'shield')) firePower(s, 'shield')
        else if (canUsePower(s, 'slow')) firePower(s, 'slow')
      }
      if (s.timeMs - seenAt >= readMs) {
        if (rand() >= accuracy) wrong = true
        slash(s, 'lane')
      }
    }
    if (s.phase === 'judging') judgeRound(s, !wrong)
  }
  return s.phase !== 'over'
}
function surviveRate(d: WordNinjaDifficulty, acc: number, readMs: number, powers = true) {
  let ok = 0
  for (let seed = 1; seed <= 60; seed++) if (botRun(d, seed, acc, readMs, powers)) ok++
  return ok / 60
}
const rows: [string, number, (r: number) => boolean][] = [
  ['easy, beginner (90%/word, reads 2.6s)', surviveRate('easy', 0.9, 2600), (r) => r >= 0.6],
  ['normal, good (97%/word, reads 1.6s)', surviveRate('normal', 0.97, 1600), (r) => r >= 0.7],
  ['easy, slow reader (95%, reads 3.4s)', surviveRate('easy', 0.95, 3400), (r) => r >= 0.5],
  ['normal, slow reader (97%, reads 3.4s) -- should pick Easy', surviveRate('normal', 0.97, 3400), (r) => r <= 0.3],
  ['normal, guesser (75%/word, reads 1.2s)', surviveRate('normal', 0.75, 1200), (r) => r <= 0.45],
  ['hard, good (97%, reads 1.6s)', surviveRate('hard', 0.97, 1600), (r) => r >= 0.35 && r <= 0.95],
  ['normal, idle', surviveRate('normal', 1, 1e9, false), (r) => r === 0],
]
for (const [label, rate, ok] of rows) assert(ok(rate), `${label}: survives ${Math.round(rate * 100)}%`)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks - failures}/${checks} checks, ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
