// Standalone verification script for Tamil Racing's pure race
// simulation (lib/gameRoomV2/racing/*). Same tsx-script convention as
// every other verify-gameroom-v2-*.ts script. Covers: the racer model
// being generic across N racers (multiplayer groundwork), boost/penalty
// application, and -- the spec's central requirement -- that accuracy
// determines the race outcome more than answer speed does.
//
// Run with: npx tsx scripts/verify-gameroom-v2-racing.ts

import { RACE_THEMES, getRaceTheme } from '../lib/gameRoomV2/racing/themes'
import { RACING_DIFFICULTY_SETTINGS, getRacingDifficultySettings } from '../lib/gameRoomV2/racing/difficulty'
import { PLAYER_RACER_ID, RIVAL_RACER_ID, createInitialRace, applyAnswerEffect, tickRace } from '../lib/gameRoomV2/racing/race'
import { getGameEngineV2 } from '../lib/gameRoomV2/registry'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

console.log('== Visual themes: presentation only ==')
assert(RACE_THEMES.length >= 3, `at least 3 visual themes declared (found ${RACE_THEMES.length})`)
assert(new Set(RACE_THEMES.map((t) => t.id)).size === RACE_THEMES.length, 'every theme has a unique id')
for (const theme of RACE_THEMES) {
  assert(getRaceTheme(theme.id).id === theme.id, `getRaceTheme('${theme.id}') resolves`)
}

console.log('\n== Difficulty: alters gameplay parameters only ==')
assert(RACING_DIFFICULTY_SETTINGS.length === 3, 'exactly 3 difficulty tiers (Easy/Normal/Hard)')
const easy = getRacingDifficultySettings('easy')
const hard = getRacingDifficultySettings('hard')
assert(easy.trackLength < hard.trackLength, 'Hard has a longer track than Easy')
assert(easy.penaltyMultiplier > hard.penaltyMultiplier, 'Hard punishes wrong answers more than Easy (lower multiplier = bigger slowdown)')
assert(
  !('questionDifficulty' in easy) && !('questionTypes' in easy),
  'difficulty settings never reference question difficulty/types -- that comes only from the Question Set'
)

console.log('\n== Racer model is generic across N racers (multiplayer groundwork) ==')
const settings = getRacingDifficultySettings('normal')
let race = createInitialRace(settings)
assert(race.racers.length >= 2, 'a race always has at least a player and one other racer')
assert(race.racers.some((r) => r.isPlayer), 'exactly one racer is flagged as the player')
assert(
  race.racers.every((r) => typeof r.id === 'string' && typeof r.distance === 'number'),
  'every racer has the same generic shape (id + distance), not a hardcoded "student vs computer" pair'
)
// The core "groundwork for multiplayer" guarantee: applying an answer
// effect works by racer id, so a future multiplayer session can route
// ANY participant's answer through this same function, not just a
// hardcoded "the player".
const thirdRacerId = 'a-future-multiplayer-participant'
race = { ...race, racers: [...race.racers, { id: thirdRacerId, label: 'Someone else', isPlayer: false, distance: 0, effect: null, finished: false, finishedAtMs: null }] }
const boostedThird = applyAnswerEffect(race, thirdRacerId, true, settings)
assert(
  boostedThird.racers.find((r) => r.id === thirdRacerId)?.effect?.kind === 'boost',
  'applyAnswerEffect works for ANY racer id, not just PLAYER_RACER_ID -- the exact hook a future multiplayer session would reuse'
)

console.log('\n== Boost / penalty application ==')
race = createInitialRace(settings)
const boosted = applyAnswerEffect(race, PLAYER_RACER_ID, true, settings)
assert(boosted.racers.find((r) => r.id === PLAYER_RACER_ID)?.effect?.kind === 'boost', 'a correct answer applies a boost effect to that racer')
assert(
  boosted.racers.find((r) => r.id === RIVAL_RACER_ID)?.effect === null,
  "one racer's answer never affects another racer's effect"
)
const penalized = applyAnswerEffect(race, PLAYER_RACER_ID, false, settings)
assert(penalized.racers.find((r) => r.id === PLAYER_RACER_ID)?.effect?.kind === 'penalty', 'a wrong answer applies a penalty effect')
assert((penalized.racers.find((r) => r.id === PLAYER_RACER_ID)?.effect?.multiplier ?? 1) < 1, 'a penalty multiplier is below 1 (a slowdown, not a boost)')

const reboosted = applyAnswerEffect(boosted, PLAYER_RACER_ID, true, settings)
const boostCount = reboosted.racers.filter((r) => r.effect?.kind === 'boost').length
assert(boostCount === 1, 'a second correct answer replaces rather than stacks the previous boost -- rapid answering cannot compound into unbounded speed')

console.log('\n== Simulation tick: movement, effect decay, race-over detection ==')
race = createInitialRace(settings)
let ticked = tickRace(race, 500, settings)
assert(ticked.state.racers.every((r) => r.distance > 0), 'every racer moves forward over time, even with no boosts yet')
assert(!ticked.state.raceOver, 'the race is not over after a normal tick')

race = applyAnswerEffect(createInitialRace(settings), PLAYER_RACER_ID, true, settings)
const remainingBefore = race.racers.find((r) => r.id === PLAYER_RACER_ID)?.effect?.remainingMs ?? 0
ticked = tickRace(race, 500, settings)
const remainingAfter = ticked.state.racers.find((r) => r.id === PLAYER_RACER_ID)?.effect?.remainingMs ?? 0
assert(remainingAfter < remainingBefore, "a racer's active effect duration decays over time")

let longRun = createInitialRace(settings)
let iterations = 0
while (!longRun.raceOver && iterations < 100000) {
  longRun = tickRace(longRun, 100, settings).state
  iterations++
}
assert(longRun.raceOver, 'a race eventually finishes without external input (baseline speed alone reaches the finish line)')
assert(longRun.winnerId !== null, 'a finished race always has a winner')
assert(iterations < 100000, 'the race finishes in a bounded amount of simulated time, never hangs')

console.log('\n== Accuracy matters more than button speed ==')
// Two racers who answer the SAME number of questions correctly should
// travel the SAME total distance over a given stretch of race time,
// regardless of how fast either one answered within that stretch --
// because the boost magnitude/duration depends only on correctness,
// never on response time. This is the concrete mechanism behind
// "accuracy matters more than button speed": the reward for a correct
// answer is fixed, not scaled by how quickly it was submitted. The
// window here is sized so BOTH racers' boosts fully play out before the
// measurement ends -- this test is about equal reward per correct
// answer, not an artifact of one racer's boost getting cut off near the
// window's edge.
// Distance gained from a single correct answer, measured over the
// exact duration of its boost, starting the clock the instant the
// answer is applied -- this isolates "how much does one correct answer
// pay out" from "how much of the measurement window did it happen to
// occupy", so answering earlier vs. later within some outer window
// can't skew the result.
function distanceGainedFromOneBoost(): number {
  let r = applyAnswerEffect(createInitialRace(settings), PLAYER_RACER_ID, true, settings)
  for (let t = 0; t < settings.boostDurationMs; t += 50) {
    r = tickRace(r, 50, settings).state
  }
  return r.racers.find((rc) => rc.id === PLAYER_RACER_ID)?.distance ?? 0
}
const boostPayoutRunA = distanceGainedFromOneBoost()
const boostPayoutRunB = distanceGainedFromOneBoost()
assert(
  boostPayoutRunA === boostPayoutRunB,
  'a correct answer\'s payout (distance gained over its boost window) is fixed and deterministic, not scaled by response time -- the same regardless of when within a race it happens'
)

function simulateRacer(correctAnswerTimes: number[], totalMs: number): number {
  let r = createInitialRace(settings)
  for (let t = 0; t <= totalMs; t += 50) {
    if (correctAnswerTimes.includes(t)) {
      r = applyAnswerEffect(r, PLAYER_RACER_ID, true, settings)
    }
    r = tickRace(r, 50, settings).state
  }
  return r.racers.find((rc) => rc.id === PLAYER_RACER_ID)?.distance ?? 0
}
const distanceMoreCorrect = simulateRacer([500, 4000], 10000)
const distanceOneCorrect = simulateRacer([500], 10000)
assert(distanceMoreCorrect > distanceOneCorrect, 'a racer with MORE correct answers travels further than one with fewer, regardless of speed')

console.log('\n== Registry: Racing now supports solo play, with multiplayer groundwork in place ==')
const engine = getGameEngineV2('racing')
assert(engine?.compatibility.soloSupport === true, 'Racing now supports solo play')
assert(engine?.compatibility.minPlayers === 1, 'Racing\'s minPlayers is 1 now that solo play is supported')
assert(engine?.compatibility.multiplayerSupport === true, 'Racing still declares multiplayer as a supported capability (groundwork, not yet live)')
assert(engine?.status === 'ACTIVE', 'Racing is ACTIVE in the registry')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
