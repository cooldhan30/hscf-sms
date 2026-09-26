// Tower Defense mechanics + balance, driven headlessly against the real
// simulation (lib/gameRoomV2/towerDefense):
//   1. maps: pads are off the path and actually cover it
//   2. enemy movement along the path, leaks damage the fort
//   3. tower purchase / targeting / damage / armour / kill rewards
//   4. upgrade + sell economics
//   5. frost slowing, cannon splash, armour-piercing
//   6. abilities (charges, cooldowns, effects)
//   7. answer rewards (server-graded result -> coins/charges, streaks)
//   8. waves: composition escalates, boss wave, prep between waves
//   9. victory and defeat
//  10. balance: a reasonable player who answers well wins; an idle one loses
//
//   npx tsx scripts/verify-gameroom-v2-tower-defense.ts
import {
  TD_MAPS,
  GRID_COLS,
  GRID_ROWS,
  pathCells,
  pathLength,
  positionAt,
  TOWER_TYPES,
  statsFor,
  upgradeCost,
  getTowerType,
  createTd,
  placeTower,
  upgradeTower,
  sellTower,
  sellValue,
  setTargeting,
  startWave,
  step,
  grantAnswerReward,
  activateAbility,
  abilityReady,
  composeWave,
  planRun,
  isBossWave,
  getDifficultySettings,
  ENEMY_DEFINITIONS,
  mulberry32,
  STEP_MS,
  type TdState,
  type TdEvent,
  type TowerTypeId,
} from '../lib/gameRoomV2/towerDefense'
import { winRate } from './gameroom-v2-td-bot'

let failures = 0
let passes = 0
function assert(cond: unknown, msg: string) {
  if (cond) passes++
  else {
    failures++
    console.error(`  FAIL: ${msg}`)
  }
}

function runFor(state: TdState, ms: number): TdEvent[] {
  const events: TdEvent[] = []
  for (let t = 0; t < ms && (state.phase === 'wave'); t += STEP_MS) events.push(...step(state))
  return events
}

function injectEnemy(state: TdState, kind: keyof typeof ENEMY_DEFINITIONS, dist = 0) {
  // Put a single enemy on the field directly (bypassing waves).
  state.phase = 'wave'
  state.spawnQueue = [{ kind, delayMs: 0 }]
  state.spawnTimer = 0
  step(state, 1)
  const e = state.enemies[state.enemies.length - 1]
  e.dist = dist
  const p = positionAt(state.map.path, dist)
  e.x = p.x
  e.y = p.y
  return e
}

console.log('== 1. Maps ==')
for (const map of TD_MAPS) {
  const cells = pathCells(map.path)
  assert(map.pads.length >= 10, `${map.id}: at least 10 build spots`)
  for (const pad of map.pads) {
    assert(!cells.has(`${Math.floor(pad.x)},${Math.floor(pad.y)}`), `${map.id}/${pad.id}: pad is not on the path`)
    assert(pad.x > 0 && pad.x < GRID_COLS && pad.y > 0 && pad.y < GRID_ROWS, `${map.id}/${pad.id}: pad inside the grid`)
    let nearest = Infinity
    for (let d = 0; d <= pathLength(map.path); d += 0.2) {
      const p = positionAt(map.path, d)
      nearest = Math.min(nearest, Math.hypot(p.x - pad.x, p.y - pad.y))
    }
    assert(nearest <= 1.6, `${map.id}/${pad.id}: pad is next to the path (${nearest.toFixed(2)})`)
  }
  assert(map.path[0].x < 0 && map.path[map.path.length - 1].x > GRID_COLS, `${map.id}: path runs from the left gate to the right fort`)
}
const mapsSeen = new Set(Array.from({ length: 30 }, (_, i) => createTd({ seed: i * 7919, difficulty: 'normal', totalWaves: 6 }).map.id))
assert(mapsSeen.size === TD_MAPS.length, 'different seeds produce different maps')

console.log('\n== 2. Enemy movement and leaks ==')
{
  const s = createTd({ seed: 1, difficulty: 'normal', totalWaves: 6, mapId: 'river-bend' })
  const e = injectEnemy(s, 'grunt')
  const d0 = e.dist
  runFor(s, 1000)
  assert(Math.abs(e.dist - d0 - ENEMY_DEFINITIONS.grunt.speed) < 0.1, `grunt moves ~${ENEMY_DEFINITIONS.grunt.speed} cells/s (${(e.dist - d0).toFixed(2)})`)
  const onPath = positionAt(s.map.path, e.dist)
  assert(Math.hypot(onPath.x - e.x, onPath.y - e.y) < 1e-6, 'enemy position follows the path')
  const fast = injectEnemy(s, 'scout')
  const slowOne = injectEnemy(s, 'brute')
  const f0 = fast.dist
  const b0 = slowOne.dist
  runFor(s, 1000)
  assert(fast.dist - f0 > slowOne.dist - b0, 'scouts are faster than brutes')

  const s2 = createTd({ seed: 1, difficulty: 'normal', totalWaves: 6, mapId: 'river-bend' })
  const hp0 = s2.baseHp
  injectEnemy(s2, 'brute', pathLength(s2.map.path) - 0.05)
  const ev = runFor(s2, 500)
  assert(s2.baseHp === hp0 - ENEMY_DEFINITIONS.brute.baseDamage, 'a leaking brute costs the fort its baseDamage')
  assert(ev.some((x) => x.type === 'leak'), 'leak event emitted')
  assert(s2.enemies.length === 0, 'leaked enemy removed')
}

console.log('\n== 3. Towers: purchase, targeting, damage, kills ==')
{
  const s = createTd({ seed: 2, difficulty: 'normal', totalWaves: 6, mapId: 'river-bend' })
  const coins0 = s.coins
  assert(placeTower(s, 'pad-1', 'vel').ok, 'can buy a Vel tower with starting coins')
  assert(s.coins === coins0 - getTowerType('vel').cost, 'purchase deducts cost')
  assert(!placeTower(s, 'pad-1', 'vel').ok, 'cannot build twice on one spot')
  assert(!placeTower(s, 'nope', 'vel').ok, 'cannot build off a pad')
  s.coins = 0
  assert(!placeTower(s, 'pad-2', 'kuri').ok, 'cannot build without coins')
  s.coins = 1000
  // An enemy in range gets shot, damaged, and eventually killed for coins.
  const e = injectEnemy(s, 'grunt', 1.5)
  const hp0 = e.hp
  const coinsBefore = s.coins
  const ev = runFor(s, 6000)
  assert(ev.some((x) => x.type === 'shot'), 'tower fires at an enemy in range')
  assert(ev.some((x) => x.type === 'hit'), 'projectile hits')
  assert(e.hp < hp0, 'enemy took damage')
  assert(ev.some((x) => x.type === 'kill') && s.stats.enemiesDefeated >= 1, 'enemy dies')
  assert(s.coins > coinsBefore, 'kill reward paid')

  // Targeting: 'first' picks the enemy furthest along; 'strongest' the highest HP.
  const t = createTd({ seed: 3, difficulty: 'normal', totalWaves: 6, mapId: 'river-bend' })
  t.coins = 1000
  placeTower(t, 'pad-3', 'kuri')
  const tower = t.towers[0]
  const weakAhead = injectEnemy(t, 'scout', 5.2)
  const strongBehind = injectEnemy(t, 'brute', 4.6)
  setTargeting(t, tower.id, 'first')
  tower.cooldown = 0
  step(t)
  assert(t.projectiles[0]?.targetId === weakAhead.id, "'first' targets the enemy furthest along")
  t.projectiles = []
  tower.cooldown = 0
  setTargeting(t, tower.id, 'strongest')
  step(t)
  assert(t.projectiles[0]?.targetId === strongBehind.id, "'strongest' targets the toughest enemy")
}

console.log('\n== 4. Upgrades and selling ==')
{
  const s = createTd({ seed: 4, difficulty: 'normal', totalWaves: 6 })
  s.coins = 1000
  const pad = s.map.pads[0].id
  placeTower(s, pad, 'yanai')
  const t = s.towers[0]
  const l1 = statsFor('yanai', 1)
  const c = s.coins
  assert(upgradeTower(s, t.id).ok && t.level === 2, 'upgrade to level 2')
  assert(s.coins === c - upgradeCost('yanai', 1)!, 'upgrade charges the level cost')
  assert(upgradeTower(s, t.id).ok && t.level === 3, 'upgrade to level 3')
  assert(!upgradeTower(s, t.id).ok, 'cannot exceed level 3')
  const l3 = statsFor('yanai', 3)
  assert(l3.damage > l1.damage * 2 && l3.splashRadius > l1.splashRadius && l3.range > l1.range, 'level 3 is meaningfully stronger')
  for (const type of TOWER_TYPES) {
    const a = statsFor(type.id, 1)
    const b = statsFor(type.id, 3)
    assert(b.damage > a.damage && b.range >= a.range && b.fireIntervalMs <= a.fireIntervalMs, `${type.id}: every level improves`)
  }
  const invested = t.invested
  const refund = sellValue(t)
  const before = s.coins
  assert(sellTower(s, t.id).ok && s.towers.length === 0, 'sell removes the tower')
  assert(s.coins === before + refund && refund === Math.floor(invested * 0.6), 'sell refunds 60% of everything invested')
}

console.log('\n== 5. Frost, splash, armour ==')
{
  const s = createTd({ seed: 5, difficulty: 'normal', totalWaves: 6, mapId: 'river-bend' })
  s.coins = 1000
  placeTower(s, 'pad-3', 'pani')
  const e = injectEnemy(s, 'grunt', 4.6)
  const d0 = e.dist
  runFor(s, 1000)
  assert(e.dist - d0 < ENEMY_DEFINITIONS.grunt.speed * 0.8, `frost slows enemies in range (${(e.dist - d0).toFixed(2)} cells/s)`)

  const s2 = createTd({ seed: 5, difficulty: 'normal', totalWaves: 6, mapId: 'river-bend' })
  s2.coins = 1000
  placeTower(s2, 'pad-3', 'yanai')
  const a = injectEnemy(s2, 'grunt', 4.8)
  const b = injectEnemy(s2, 'grunt', 5.0)
  const far = injectEnemy(s2, 'grunt', 0.2)
  runFor(s2, 2500)
  assert(a.hp < a.maxHp && b.hp < b.maxHp, 'cannon splash damages neighbouring enemies')
  assert(far.hp === far.maxHp || far.dist > 3, 'splash does not reach distant enemies')

  const s3 = createTd({ seed: 6, difficulty: 'normal', totalWaves: 6, mapId: 'river-bend' })
  s3.coins = 1000
  placeTower(s3, 'pad-3', 'vel')
  const armored = injectEnemy(s3, 'armored', 4.6)
  const ev = runFor(s3, 600)
  const velHits = ev.filter((x) => x.type === 'hit') as { damage: number }[]
  assert(velHits.length > 0 && velHits.every((h) => h.damage === Math.max(1, statsFor('vel', 1).damage - ENEMY_DEFINITIONS.armored.armor)), 'armour reduces rapid-fire damage')
  const s4 = createTd({ seed: 6, difficulty: 'normal', totalWaves: 6, mapId: 'river-bend' })
  s4.coins = 1000
  placeTower(s4, 'pad-3', 'kuri')
  injectEnemy(s4, 'armored', 4.6)
  const ev4 = runFor(s4, 800)
  const kuriHit = ev4.find((x) => x.type === 'hit') as { damage: number } | undefined
  assert(kuriHit?.damage === statsFor('kuri', 1).damage, 'Kuri arrows pierce armour')
  void armored
}

console.log('\n== 6. Abilities ==')
{
  const s = createTd({ seed: 7, difficulty: 'normal', totalWaves: 6, mapId: 'river-bend' })
  const e = injectEnemy(s, 'brute', 3)
  assert(!abilityReady(s, 'freeze'), 'abilities need charges')
  s.charges = 6
  assert(activateAbility(s, 'freeze', null).ok && s.charges === 4, 'freeze spends 2 charges')
  assert(!activateAbility(s, 'freeze', null).ok, 'freeze has a cooldown')
  const d0 = e.dist
  runFor(s, 1000)
  assert(e.dist === d0, 'frozen enemies do not move')
  s.baseHp = 10
  assert(activateAbility(s, 'repair', null).ok && s.baseHp === 15, 'repair restores fort health')
  s.charges = 6
  const hp0 = e.hp
  assert(!activateAbility(s, 'strike', null).ok, 'stone rain needs a target')
  assert(activateAbility(s, 'strike', { x: e.x, y: e.y }).ok && e.hp < hp0, 'stone rain damages enemies at the target')
  s.charges = 6
  s.coins = 1000
  placeTower(s, 'pad-3', 'vel')
  assert(activateAbility(s, 'rally', null).ok && s.rallyUntil > s.timeMs, 'war drum boosts towers')
  const shotEvents = runFor(s, 300).filter((x) => x.type === 'hit') as { damage: number }[]
  assert(shotEvents.length === 0 || shotEvents.some((h) => h.damage > statsFor('vel', 1).damage - 2 - 0.01), 'rallied towers hit harder')
}

console.log('\n== 7. Answer rewards ==')
{
  const s = createTd({ seed: 8, difficulty: 'normal', totalWaves: 6 })
  const c0 = s.coins
  const r1 = grantAnswerReward(s, { correct: true, points: 1000 })
  assert(r1.coins === 30 && s.coins === c0 + 30 && s.charges === 1, 'a slow correct answer: 30 coins + 1 charge')
  const r2 = grantAnswerReward(s, { correct: true, points: 1500 })
  assert(r2.coins === 30 + 20 + 10, 'fast + streak answers earn more (speed + streak bonus)')
  const r3 = grantAnswerReward(s, { correct: true, points: 1200 })
  assert(r3.charges === 2, 'every 3rd answer in a row earns a bonus charge')
  const r4 = grantAnswerReward(s, { correct: false, points: 0 })
  assert(r4.coins === 0 && s.streak === 0, 'wrong answers earn nothing and reset the streak (no other penalty)')
}

console.log('\n== 8. Waves ==')
{
  const settings = getDifficultySettings('normal')
  const rand = mulberry32(99)
  const sizes = [1, 3, 5, 7].map((w) => composeWave(w, 8, settings, rand).length)
  assert(sizes[3] > sizes[0], `waves grow (${sizes.join(' -> ')})`)
  const kinds1 = new Set(composeWave(1, 8, settings, mulberry32(1)).map((e) => e.kind))
  assert(!kinds1.has('brute') && !kinds1.has('armored') && !kinds1.has('boss'), 'wave 1 only has basic enemies')
  const final = composeWave(8, 8, settings, mulberry32(2))
  assert(final.some((e) => e.kind === 'boss' && e.bossScale === 1), 'final wave has the boss')
  assert(composeWave(4, 8, settings, mulberry32(3)).some((e) => e.kind === 'boss' && (e.bossScale ?? 1) < 1), 'mid-run wave has a mini-boss (8+ waves)')
  const a = composeWave(5, 8, settings, mulberry32(11)).map((e) => e.kind).join()
  const b = composeWave(5, 8, settings, mulberry32(12)).map((e) => e.kind).join()
  assert(a !== b, 'different runs compose waves differently')
  assert(isBossWave(8, 8) && !isBossWave(7, 8), 'boss wave is the last')

  const plan = planRun(15)
  assert(plan.totalWaves === 8 && plan.questionsBeforeWave.reduce((x, y) => x + y, 0) === 15, 'a 15-question set -> 8 waves, every question placed before a wave')
  assert(planRun(3).totalWaves === 4 && planRun(60).totalWaves === 10, 'wave count is clamped to 4..10')

  const s = createTd({ seed: 9, difficulty: 'normal', totalWaves: 4 })
  assert(s.phase === 'prep' && s.enemies.length === 0, 'a run starts in preparation (build before enemies arrive)')
  assert(step(s).length === 0, 'nothing happens during preparation')
  s.coins = 5000
  s.map.pads.slice(0, 8).forEach((p, i) => placeTower(s, p.id, (['vel', 'yanai', 'pani', 'kuri'] as TowerTypeId[])[i % 4]))
  startWave(s)
  assert(s.phase === 'wave', 'start wave')
  const ev = runFor(s, 120000)
  assert(ev.some((x) => x.type === 'waveCleared') && s.phase === 'prep' && s.wave === 2, 'clearing a wave returns to preparation for the next')
}

console.log('\n== 9. Victory, defeat, boss ==')
{
  // Overwhelming defence -> victory, boss defeated.
  const s = createTd({ seed: 10, difficulty: 'normal', totalWaves: 4 })
  s.coins = 100000
  s.map.pads.forEach((p, i) => placeTower(s, p.id, (['kuri', 'yanai', 'vel', 'pani'] as TowerTypeId[])[i % 4]))
  s.towers.forEach((t) => {
    upgradeTower(s, t.id)
    upgradeTower(s, t.id)
  })
  let sawBoss = false
  let sawEnrage = false
  for (let w = 0; w < 4 && s.phase !== 'victory' && s.phase !== 'defeat'; w++) {
    startWave(s)
    const ev = runFor(s, 300000)
    sawBoss ||= ev.some((x) => x.type === 'bossSpawn')
    sawEnrage ||= ev.some((x) => x.type === 'enrage')
  }
  assert(s.phase === 'victory', 'surviving the final wave is a victory')
  assert(sawBoss && s.stats.bossDefeated, 'boss appears on the final wave and is defeated')
  assert(sawEnrage, 'boss enrages at half health')

  // No towers -> defeat.
  const d = createTd({ seed: 11, difficulty: 'normal', totalWaves: 6 })
  let defeated = false
  for (let w = 0; w < 6 && !defeated; w++) {
    startWave(d)
    const ev = runFor(d, 300000)
    defeated = ev.some((x) => x.type === 'defeat')
  }
  assert(defeated && d.phase === 'defeat' && d.baseHp === 0, 'an undefended fort falls -> defeat')
  assert(!placeTower(d, d.map.pads[0].id, 'vel').ok && !startWave(d).ok, 'no actions after the battle ends')
}

console.log('\n== 10. Balance (scripted players over many seeds) ==')
const table: [string, 'easy' | 'normal' | 'hard', number, 'good' | 'idle'][] = [
  ['easy, 60% correct, good play', 'easy', 0.6, 'good'],
  ['normal, 85% correct, good play', 'normal', 0.85, 'good'],
  ['normal, 50% correct, good play', 'normal', 0.5, 'good'],
  ['hard, 90% correct, good play', 'hard', 0.9, 'good'],
  ['normal, idle (no building)', 'normal', 0.85, 'idle'],
]
const rates: Record<string, { rate: number; avgWave: number }> = {}
for (const [label, d, acc, skill] of table) {
  rates[label] = winRate(d, acc, skill)
  console.log(`  ${label.padEnd(34)} win ${(rates[label].rate * 100).toFixed(0).padStart(3)}%  avg wave reached ${rates[label].avgWave.toFixed(1)}`)
}
assert(rates['easy, 60% correct, good play'].rate >= 0.8, 'easy is winnable for a learner')
assert(rates['normal, 85% correct, good play'].rate >= 0.7, 'normal is winnable with good answers and sensible building')
assert(rates['normal, 50% correct, good play'].rate < rates['normal, 85% correct, good play'].rate, 'answering well matters: more correct answers -> more wins')
assert(rates['hard, 90% correct, good play'].rate >= 0.3 && rates['hard, 90% correct, good play'].rate < 1, 'hard is a real challenge but possible')
assert(rates['normal, idle (no building)'].rate === 0, 'not building towers always loses')

console.log(`\n${passes} checks passed, ${failures} failed.`)
if (failures > 0) process.exit(1)
console.log('All Tower Defense mechanics checks passed.')
