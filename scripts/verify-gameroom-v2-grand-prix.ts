// Solo Racing ("Tamil Grand Prix") mechanics and balance, driven headlessly
// against lib/gameRoomV2/racing/grandPrix.ts:
//   speed, countdown, boost meter + activation, answer effects (correct /
//   fast / combo / wrong), fair recovery, slipstream, checkpoints, laps,
//   overtakes, placement, finish; and balance over many seeded races.
//
//   npx tsx scripts/verify-gameroom-v2-grand-prix.ts
import {
  createGp,
  stepGp,
  answerChallenge,
  activateBoost,
  canBoost,
  player,
  placeOf,
  standings,
  lapOf,
  RACE_LENGTH,
  LAP_LENGTH,
  BOOST_MULTIPLIER,
  COUNTDOWN_MS,
  WRONG_SLOW_MS,
  type GpState,
  type GpEvent,
} from '../lib/gameRoomV2/racing/grandPrix'
import { mulberry32 } from '../lib/gameRoomV2/gameplay/rng'

let failures = 0
let passes = 0
function assert(cond: unknown, msg: string) {
  if (cond) passes++
  else {
    failures++
    console.error(`  FAIL: ${msg}`)
  }
}
function run(s: GpState, ms: number): GpEvent[] {
  const ev: GpEvent[] = []
  for (let t = 0; t < ms && !s.raceOver; t += 1000 / 30) ev.push(...stepGp(s))
  return ev
}

console.log('== Start, speed, countdown ==')
{
  const s = createGp({ seed: 1, difficulty: 'normal', totalQuestions: 15 })
  assert(s.racers.length === 4 && s.racers.filter((r) => !r.isPlayer).length === 3, 'four racers: you + three rivals')
  const ev = run(s, COUNTDOWN_MS - 50)
  assert(ev.filter((e) => e.type === 'countdown').length === 3 && player(s).dist === 0, 'a 3-2-1 countdown before anyone moves')
  const go = run(s, 100)
  assert(go.some((e) => e.type === 'go'), 'GO!')
  const d0 = player(s).dist
  run(s, 1000)
  assert(Math.abs(player(s).dist - d0 - s.baseSpeed) < s.baseSpeed * 0.15, 'player cruises at base speed')
}

console.log('\n== Boost meter and answers ==')
{
  const s = createGp({ seed: 2, difficulty: 'normal', totalQuestions: 15 })
  run(s, COUNTDOWN_MS + 100)
  const m0 = s.meter
  answerChallenge(s, { correct: true, points: 1000 })
  assert(s.meter === m0 + 30, 'a correct answer charges the boost meter')
  const m1 = s.meter
  answerChallenge(s, { correct: true, points: 1500 })
  assert(s.meter - m1 === Math.min(100 - m1, 30 + 15 + 5), 'faster answers and combos charge more')
  assert(canBoost(s) && activateBoost(s) && s.boosting, 'player chooses when to boost')
  assert(!activateBoost(s), 'cannot stack boosts')
  const d0 = player(s).dist
  run(s, 1000)
  assert(player(s).dist - d0 > s.baseSpeed * (BOOST_MULTIPLIER - 0.2), 'boosting is much faster')
  run(s, 6000)
  assert(!s.boosting && s.meter === 0, 'boost drains the meter, then ends')
  assert(!canBoost(s), 'empty meter: no boost')

  const w = createGp({ seed: 3, difficulty: 'normal', totalQuestions: 15 })
  run(w, COUNTDOWN_MS + 100)
  w.meter = 60
  answerChallenge(w, { correct: false, points: 0 })
  assert(w.meter === 30 && w.streak === 0, 'a wrong answer drains 30 boost and resets the combo')
  const d0w = player(w).dist
  run(w, 1000)
  assert(player(w).dist - d0w < w.baseSpeed * 0.9, 'a wrong answer briefly slows you')
  run(w, WRONG_SLOW_MS)
  const d1 = player(w).dist
  run(w, 1000)
  assert(player(w).dist - d1 >= w.baseSpeed * 0.95, '...but only briefly (fair recovery)')
}

console.log('\n== Checkpoints, laps, overtakes, finish ==')
{
  const s = createGp({ seed: 4, difficulty: 'easy', totalQuestions: 12 })
  const ev: GpEvent[] = []
  let guard = 0
  while (!s.raceOver && guard++ < 100000) {
    const e = stepGp(s)
    ev.push(...e)
    if (e.some((x) => x.type === 'checkpoint')) {
      answerChallenge(s, { correct: true, points: 1400 })
      activateBoost(s)
    }
  }
  assert(ev.filter((e) => e.type === 'checkpoint').length === 12, 'one checkpoint challenge per question')
  assert(s.checkpoints.every((c) => c < RACE_LENGTH * 0.95), 'all challenges come before the finish line')
  assert(ev.filter((e) => e.type === 'lap').map((e) => (e as { lap: number }).lap).join() === '2,3', 'laps 2 and 3 announced')
  assert(lapOf(LAP_LENGTH * 2 + 1) === 3 && lapOf(RACE_LENGTH) === 3, 'lap counter')
  assert(ev.filter((e) => e.type === 'finish').length === 4 && s.raceOver, 'every racer finishes, then the race is over')
  assert(s.finishOrder.length === 4 && placeOf(s, 'player') === s.finishOrder.indexOf('player') + 1, 'placement = finish order')
  assert(ev.some((e) => e.type === 'overtake') || placeOf(s, 'player') === 1, 'overtakes are detected')
  assert(standings(s)[0].finishedAt! <= standings(s)[3].finishedAt!, 'standings sorted by finish time')
}

console.log('\n== Balance (seeded races, scripted player) ==')
function race(seed: number, difficulty: 'easy' | 'normal' | 'hard', accuracy: number, boosts: boolean): number {
  const s = createGp({ seed, difficulty, totalQuestions: 15 })
  const rand = mulberry32(seed ^ 0x5eed)
  let pendingSince: number | null = null
  let guard = 0
  while (!s.raceOver && guard++ < 200000) {
    const ev = stepGp(s)
    if (ev.some((e) => e.type === 'checkpoint')) pendingSince = s.timeMs
    // It takes the student a few seconds to read and answer.
    if (pendingSince !== null && s.timeMs - pendingSince > 3000 + rand() * 3000) {
      const correct = rand() < accuracy
      answerChallenge(s, { correct, points: correct ? 1000 + Math.floor(rand() * 500) : 0 })
      pendingSince = null
    }
    if (boosts && s.meter >= 60) activateBoost(s)
  }
  return placeOf(s, 'player')
}
const SEEDS = Array.from({ length: 60 }, (_, i) => 77 + i * 131)
function stats(d: 'easy' | 'normal' | 'hard', acc: number, boosts: boolean) {
  const places = SEEDS.map((seed) => race(seed, d, acc, boosts))
  return { win: places.filter((p) => p === 1).length / places.length, podium: places.filter((p) => p <= 2).length / places.length, avg: places.reduce((a, b) => a + b, 0) / places.length }
}
const rows: [string, 'easy' | 'normal' | 'hard', number, boolean][] = [
  ['easy, 60% correct, boosts', 'easy', 0.6, true],
  ['normal, 85% correct, boosts', 'normal', 0.85, true],
  ['normal, 50% correct, boosts', 'normal', 0.5, true],
  ['normal, 85% correct, never boosts', 'normal', 0.85, false],
  ['hard, 90% correct, boosts', 'hard', 0.9, true],
]
const r: Record<string, ReturnType<typeof stats>> = {}
for (const [label, d, acc, b] of rows) {
  r[label] = stats(d, acc, b)
  console.log(`  ${label.padEnd(36)} win ${(r[label].win * 100).toFixed(0).padStart(3)}%  top-2 ${(r[label].podium * 100).toFixed(0).padStart(3)}%  avg place ${r[label].avg.toFixed(2)}`)
}
assert(r['easy, 60% correct, boosts'].podium >= 0.8, 'easy: a learner usually makes the top 2')
assert(r['normal, 85% correct, boosts'].win >= 0.5, 'normal: good answers + smart boosting usually win')
assert(r['normal, 50% correct, boosts'].win < r['normal, 85% correct, boosts'].win, 'more correct answers -> more wins')
assert(r['normal, 85% correct, never boosts'].win < r['normal, 85% correct, boosts'].win, 'using the boost matters (a real decision)')
assert(r['hard, 90% correct, boosts'].win >= 0.2 && r['hard, 90% correct, boosts'].win < 0.95, 'hard: winnable, not a given')
assert(r['normal, 50% correct, boosts'].avg < 4, 'a struggling student is not always last (catch-up works)')

console.log(`\n${passes} checks passed, ${failures} failed.`)
if (failures > 0) process.exit(1)
console.log('All Grand Prix checks passed.')
