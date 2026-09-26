// Standalone verification script for Space Mission's pure flight logic
// (lib/gameRoomV2/spaceMission/*). Same tsx-script convention as every
// other verify-gameroom-v2-*.ts script. Covers: the mission route being
// ordered and reachable, difficulty economics (thrust/shield damage),
// streak-driven thrust bonus determinism, shield recharge/damage
// bounds, recovery never blocking progress, and mission completion.
//
// Run with: npx tsx scripts/verify-gameroom-v2-space-mission.ts

import { MISSION_ROUTE, MISSION_LENGTH, getPlanet, nextUnreachedPlanet, reachedPlanetIds } from '../lib/gameRoomV2/spaceMission/route'
import { SPACE_MISSION_DIFFICULTY_SETTINGS, getSpaceMissionDifficultySettings } from '../lib/gameRoomV2/spaceMission/difficulty'
import {
  createInitialFlight,
  streakThrustMultiplier,
  applyCorrectAnswer,
  applyWrongAnswer,
  resolveRecovery,
  missionProgressPct,
  nextCheckpoint,
  STREAK_THRUST_BONUS_CAP,
} from '../lib/gameRoomV2/spaceMission/flight'
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

console.log('== Mission route: ordered, reachable, well-formed ==')
assert(MISSION_ROUTE.length >= 4, `at least 4 planets declared (found ${MISSION_ROUTE.length})`)
assert(MISSION_ROUTE[0].distance === 0, 'the route starts at distance 0 (Launch Pad)')
assert(MISSION_LENGTH === MISSION_ROUTE[MISSION_ROUTE.length - 1].distance, 'MISSION_LENGTH matches the final planet\'s distance')
for (let i = 1; i < MISSION_ROUTE.length; i++) {
  assert(MISSION_ROUTE[i].distance > MISSION_ROUTE[i - 1].distance, `${MISSION_ROUTE[i].name} is strictly further than ${MISSION_ROUTE[i - 1].name}`)
}
assert(getPlanet('launch').id === 'launch', 'getPlanet resolves a known planet id')
let threw = false
try {
  getPlanet('nonexistent')
} catch {
  threw = true
}
assert(threw, 'getPlanet throws for an unknown planet id')

console.log('\n== Checkpoint tracking ==')
assert(reachedPlanetIds(0).length === 1, 'only the launch pad is reached at distance 0')
assert(reachedPlanetIds(MISSION_LENGTH).length === MISSION_ROUTE.length, 'every planet is reached once distance covers the full route')
assert(nextUnreachedPlanet(0)?.id === MISSION_ROUTE[1].id, 'the next checkpoint after launch is the second planet')
assert(nextUnreachedPlanet(MISSION_LENGTH) === null, 'there is no next checkpoint once the route is fully travelled')

console.log('\n== Difficulty: alters gameplay parameters only ==')
assert(SPACE_MISSION_DIFFICULTY_SETTINGS.length === 3, 'exactly 3 difficulty tiers (Cadet/Pilot/Commander)')
const cadet = getSpaceMissionDifficultySettings('cadet')
const commander = getSpaceMissionDifficultySettings('commander')
assert(cadet.thrustPerCorrectAnswer > commander.thrustPerCorrectAnswer, 'Cadet grants more thrust per correct answer than Commander')
assert(cadet.shieldDamagePerWrongAnswer < commander.shieldDamagePerWrongAnswer, 'Cadet takes less shield damage per wrong answer than Commander')
assert(
  !('questionDifficulty' in cadet) && !('questionTypes' in cadet),
  'difficulty settings never reference question difficulty/types -- that comes only from the Question Set'
)

console.log('\n== Streak thrust bonus is deterministic, not random ==')
assert(streakThrustMultiplier(0) === 1, 'zero streak grants no thrust bonus')
assert(streakThrustMultiplier(1) > 1, 'a streak of 1 grants some bonus')
assert(streakThrustMultiplier(3) > streakThrustMultiplier(1), 'a longer streak grants more bonus than a shorter one')
assert(streakThrustMultiplier(100) === 1 + STREAK_THRUST_BONUS_CAP, 'the thrust bonus is capped, not unbounded')

console.log('\n== Correct answers: thrust, shield recharge, streak growth ==')
const pilot = getSpaceMissionDifficultySettings('pilot')
let state = createInitialFlight(pilot)
assert(state.distanceTravelled === 0, 'the mission starts at distance 0')
assert(state.shields === pilot.startingShields, 'the mission starts at full shields')
assert(state.currentStreak === 0, 'the mission starts with no streak')
const beforeDistance = state.distanceTravelled
state = applyCorrectAnswer(state, pilot)
assert(state.distanceTravelled > beforeDistance, 'a correct answer moves the ship forward')
assert(state.currentStreak === 1, 'a correct answer grows the streak')
assert(state.bestStreak === 1, 'bestStreak tracks the current streak as it grows')
assert(state.shields <= state.maxShields, 'a correct answer\'s shield recharge never exceeds the max')

console.log('\n== Wrong answers: shield damage, streak reset, recovery -- never a hard stop ==')
state = createInitialFlight(pilot)
state = applyCorrectAnswer(state, pilot)
state = applyCorrectAnswer(state, pilot)
assert(state.currentStreak === 2, 'streak built up over two correct answers')
const distanceBeforeWrong = state.distanceTravelled
state = applyWrongAnswer(state, pilot)
assert(state.currentStreak === 0, 'a wrong answer resets the streak')
assert(state.shields === pilot.startingShields - pilot.shieldDamagePerWrongAnswer, 'a wrong answer costs exactly its configured shield damage')
assert(state.distanceTravelled === distanceBeforeWrong, 'a wrong answer never moves the ship backward')
assert(state.recovering === true, 'a wrong answer opens a recovery beat')
state = resolveRecovery(state)
assert(state.recovering === false, 'resolving recovery clears the recovering flag')
assert(state.missionComplete === false, 'a wrong answer never ends the mission')

console.log('\n== Shields never go negative, and hitting zero does not end the mission ==')
state = createInitialFlight(pilot)
for (let i = 0; i < 20; i++) {
  state = applyWrongAnswer(state, pilot)
  state = resolveRecovery(state)
}
assert(state.shields === 0, 'shields bottom out at exactly zero, never negative')
assert(state.missionComplete === false, 'the mission is still flyable with zero shields -- no game-over state exists')

console.log('\n== Mission completion: reachable purely through correct answers ==')
state = createInitialFlight(cadet)
let iterations = 0
while (!state.missionComplete && iterations < 200) {
  state = applyCorrectAnswer(state, cadet)
  iterations++
}
assert(state.missionComplete, 'answering enough questions correctly eventually completes the mission')
assert(iterations < 200, 'reaching the home system happens in a bounded number of steps, never hangs')
assert(state.distanceTravelled === MISSION_LENGTH, 'distanceTravelled is clamped exactly at the mission length, never overshoots')
assert(missionProgressPct(state) === 100, 'mission progress reads 100% once complete')
assert(nextCheckpoint(state) === null, 'there is no next checkpoint once the mission is complete')
assert(reachedPlanetIds(state.distanceTravelled).length === MISSION_ROUTE.length, 'every planet is marked reached at mission completion')

console.log('\n== Registry: Space Mission has a real, testable engine behind it ==')
const engine = getGameEngineV2('space-mission')
assert(engine !== undefined, 'space-mission is registered')
assert(engine?.status === 'COMING_SOON', 'Space Mission is hidden (COMING_SOON) until rebuilt as a real game -- its logic stays tested here')
assert(engine?.compatibility.soloSupport === true, 'Space Mission supports solo play')
assert(engine?.compatibility.supportedQuestionTypes.includes('MULTIPLE_CHOICE') === true, 'Space Mission supports MULTIPLE_CHOICE questions')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
