// Standalone verification script for the Tamil Tower Defense engine's
// pure battlefield simulation (lib/gameRoomV2/towerDefense/*). Same
// tsx-script convention as every other verify-gameroom-v2-*.ts script
// (no formal test framework exists in this repo). Covers: tower
// placement/upgrade economics, wave composition, the wrong-answer
// consequence and correct-answer reward, enemy movement/combat
// resolution, and win/loss detection -- everything that can be tested
// without a browser or a live session.
//
// Run with: npx tsx scripts/verify-gameroom-v2-tower-defense.ts

import { TOWER_TYPES, getTowerType, upgradedStats } from '../lib/gameRoomV2/towerDefense/towers'
import { DIFFICULTY_SETTINGS, getDifficultySettings } from '../lib/gameRoomV2/towerDefense/difficulty'
import { PATH_WAYPOINTS, pathLength, positionAtDistance, waveComposition, scaledEnemyStats } from '../lib/gameRoomV2/towerDefense/waves'
import {
  TOWER_PADS,
  createInitialBattlefield,
  startWave,
  canAffordTower,
  placeTower,
  upgradeTower,
  applyWrongAnswerConsequence,
  applyCorrectAnswerReward,
  tickBattlefield,
  advanceToNextWave,
} from '../lib/gameRoomV2/towerDefense/simulation'
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

console.log('== Tower types: 3 clearly different mechanics ==')
assert(TOWER_TYPES.length === 3, `exactly 3 tower types (found ${TOWER_TYPES.length})`)
const vel = getTowerType('vel')
const yanai = getTowerType('yanai')
const pani = getTowerType('pani')
assert(vel.fireIntervalMs < yanai.fireIntervalMs, 'Vel Spear fires faster than Yanai Cannon (the "fast tower")')
assert(yanai.damage > vel.damage && yanai.damage > pani.damage, 'Yanai Cannon hits hardest (the "heavy tower")')
assert(pani.slowFactor < 1 && vel.slowFactor === 1 && yanai.slowFactor === 1, 'only Pani Frost Chime slows enemies (the "slow tower")')
assert(yanai.splashRadius > 0 && vel.splashRadius === 0 && pani.splashRadius === 0, 'only Yanai Cannon splashes nearby enemies')

console.log('\n== Upgrade math ==')
const baseStats = upgradedStats(vel, 1)
const upgradedOnce = upgradedStats(vel, 2)
assert(upgradedOnce.damage > baseStats.damage, 'upgrading a tower increases its damage')
assert(upgradedOnce.range > baseStats.range, 'upgrading a tower increases its range')
assert(upgradedOnce.fireIntervalMs < baseStats.fireIntervalMs, 'upgrading a tower fires faster')

console.log('\n== Difficulty: alters gameplay parameters only ==')
assert(DIFFICULTY_SETTINGS.length === 3, 'exactly 3 difficulty tiers (Easy/Normal/Hard)')
const easy = getDifficultySettings('easy')
const hard = getDifficultySettings('hard')
assert(easy.enemyHealthMultiplier < hard.enemyHealthMultiplier, 'Hard enemies have more health than Easy')
assert(easy.enemySpeedMultiplier < hard.enemySpeedMultiplier, 'Hard enemies move faster than Easy')
assert(easy.startingCoins > hard.startingCoins, 'Easy starts with more coins than Hard')
assert(
  !('questionDifficulty' in easy) && !('questionTypes' in easy),
  'difficulty settings never reference question difficulty/types -- that comes only from the Question Set'
)

console.log('\n== Path & waves ==')
assert(PATH_WAYPOINTS.length >= 2, 'the path has at least a start and end waypoint')
assert(pathLength() > 0, 'the path has a positive total length')
const start = positionAtDistance(0)
assert(start.x === PATH_WAYPOINTS[0].x && start.y === PATH_WAYPOINTS[0].y, 'distance 0 resolves to the path start')
const end = positionAtDistance(pathLength() + 100)
const lastWaypoint = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1]
assert(end.x === lastWaypoint.x && end.y === lastWaypoint.y, 'a distance beyond the path length clamps to the final waypoint, never throws')

const wave1 = waveComposition(1, easy)
const wave5 = waveComposition(5, easy)
assert(wave5.length > wave1.length, 'later waves have more enemies than earlier waves')
assert(wave1.every((k) => k === 'runner'), 'wave 1 is runners only -- a gentle start')
assert(wave5.some((k) => k === 'brute') && wave5.some((k) => k === 'shade'), 'later waves introduce tougher enemy kinds')

const stats = scaledEnemyStats('runner', 5, easy)
const statsWave1 = scaledEnemyStats('runner', 1, easy)
assert(stats.maxHealth > statsWave1.maxHealth, 'the same enemy kind is tougher in a later wave')

console.log('\n== Tower placement & upgrade economics ==')
let state = createInitialBattlefield('normal', 6)
const pad = TOWER_PADS[0].id
assert(canAffordTower(state, 'vel'), 'starting coins can afford at least the cheapest tower')
const afterPlace = placeTower(state, pad, 'vel')
assert(afterPlace.coins === state.coins - vel.cost, 'placing a tower deducts its exact cost')
assert(afterPlace.towers.length === 1 && afterPlace.towers[0].padId === pad, 'the tower is recorded on the chosen pad')
const doublePlace = placeTower(afterPlace, pad, 'yanai')
assert(doublePlace.towers.length === 1, 'a pad that already has a tower cannot be built on again')
const brokeState = { ...state, coins: 0 }
const failedPlace = placeTower(brokeState, pad, 'vel')
assert(failedPlace.towers.length === 0 && failedPlace.coins === 0, 'placing a tower with insufficient coins does nothing')

const upgraded = upgradeTower(afterPlace, pad)
assert(upgraded.towers[0].level === 2, 'upgrading an existing tower increases its level')
assert(upgraded.coins < afterPlace.coins, 'upgrading a tower costs coins')
const upgradeNoMoney = upgradeTower({ ...afterPlace, coins: 0 }, pad)
assert(upgradeNoMoney.towers[0].level === 1, 'upgrading without enough coins does nothing')

console.log('\n== Correct/wrong answer consequences ==')
state = startWave(createInitialBattlefield('normal', 6))
const rewarded = applyCorrectAnswerReward(state, 25)
assert(rewarded.coins === state.coins + 25, 'a correct answer adds exactly the awarded coins')

let advancing = tickBattlefield(state, 5000).state
const beforePushback = advancing.enemies.map((e) => e.distance)
const afterPushback = applyWrongAnswerConsequence(advancing)
assert(
  afterPushback.enemies.every((e, i) => e.distance >= beforePushback[i]),
  'a wrong answer nudges every enemy on the path forward, never backward'
)
assert(afterPushback.baseHealth === advancing.baseHealth, 'a wrong answer alone never directly damages the base -- only a completed path crossing does')

console.log('\n== Simulation tick: combat resolution ==')
state = startWave(createInitialBattlefield('easy', 1))
let ticks = 0
while (state.enemies.length === 0 && state.enemiesQueued.length > 0 && ticks < 50) {
  state = tickBattlefield(state, 100).state
  ticks++
}
assert(state.enemies.length > 0, 'enemies actually spawn from the queue over time')

// Place every tower type near the front of the path and simulate long
// enough that a full wave should be cleared, to prove towers can
// actually stop and defeat enemies (not just visually track them).
state = startWave(createInitialBattlefield('easy', 1))
state = { ...state, coins: 500 }
state = placeTower(state, 'pad-1', 'vel')
state = placeTower(state, 'pad-2', 'yanai')
state = placeTower(state, 'pad-3', 'pani')
let totalDefeated = 0
for (let i = 0; i < 4000 && !state.gameOver && !state.victory; i++) {
  const result = tickBattlefield(state, 100)
  state = result.state
  totalDefeated += result.enemiesDefeated
}
assert(totalDefeated > 0, 'towers actually defeat enemies over the course of a wave')
assert(state.victory || state.wave > 1, 'a well-defended single-wave session reaches victory rather than stalling forever')

console.log('\n== Undefended waves cannot be won -- learning must matter more than twitch speed ==')
let undefended = startWave(createInitialBattlefield('normal', 1))
for (let i = 0; i < 3000 && !undefended.gameOver && !undefended.victory; i++) {
  undefended = tickBattlefield(undefended, 100).state
}
assert(undefended.gameOver, 'with zero towers ever placed (i.e. ignoring every question), the fort always falls -- the spec\'s explicit anti-cheese requirement')

console.log('\n== Wave progression ==')
let progressed = startWave(createInitialBattlefield('normal', 3))
progressed = { ...progressed, waveActive: false }
const nextWave = advanceToNextWave(progressed)
assert(nextWave.wave === 2, 'advancing moves to the next wave number')
const capped = advanceToNextWave({ ...progressed, wave: 3 })
assert(capped.wave === 3, 'advancing past the final wave does not overflow the wave counter')

console.log('\n== Registry: Tower Defense is now a real, playable engine ==')
const engine = getGameEngineV2('tower-defense')
assert(engine?.status === 'ACTIVE', 'Tower Defense is ACTIVE in the registry')
assert(engine?.compatibility.supportedQuestionTypes.includes('MULTIPLE_CHOICE') ?? false, 'Tower Defense still supports MULTIPLE_CHOICE questions')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
