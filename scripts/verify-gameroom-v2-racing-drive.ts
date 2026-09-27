// Mechanics tests for the Tamil Grand Prix driving simulation
// (lib/gameRoomV2/racing/{track,drive}.ts): track geometry, car physics
// (acceleration, braking, steering, grass, walls), lap/sector anti-cheat,
// rival AI that really drives the track, standings from driving (not
// answers), learning gates, boost from graded answers, slow-motion while
// a question is open, and the finish.
//
// Run with: npx tsx scripts/verify-gameroom-v2-racing-drive.ts

import { getTrack, project, sampleAt } from '../lib/gameRoomV2/racing/track'
import {
  createDrive,
  stepDrive,
  botInput,
  applyAnswer,
  canBoost,
  recover,
  wrongWay,
  player,
  standings,
  placeOf,
  planLearningGates,
  drainEvents,
  LAPS,
  STEP_S,
  BOOST_MIN,
  GRASS_MAX,
  QUESTION_TIME_SCALE,
  type DriveState,
  type DriveEvent,
  type DriveDifficulty,
} from '../lib/gameRoomV2/racing/drive'

let failures = 0
let checks = 0
function assert(cond: boolean, msg: string) {
  checks++
  if (!cond) {
    failures++
    console.error(`  FAIL: ${msg}`)
  } else console.log(`  ok: ${msg}`)
}

const IDLE = { throttle: 0, brake: 0, steer: 0, boost: false }
const GAS = { throttle: 1, brake: 0, steer: 0, boost: false }
function run(s: DriveState, seconds: number, input: (s: DriveState) => typeof IDLE): DriveEvent[] {
  const ev: DriveEvent[] = []
  for (let i = 0; i < seconds / STEP_S && !s.raceOver; i++) ev.push(...stepDrive(s, input(s)))
  return ev
}
function started(difficulty: DriveDifficulty = 'normal', questions = 6, seed = 1) {
  const s = createDrive({ seed, difficulty, questions })
  run(s, 3.05, () => IDLE)
  return s
}

console.log('== Track ==')
const track = getTrack()
assert(track.length > 6000 && track.samples.length > 500, `a real circuit (${Math.round(track.length)} units, ${track.samples.length} samples)`)
{
  let worst = Infinity
  const n = track.samples.length
  for (let i = 0; i < n; i += 3)
    for (let j = i + 3; j < n; j += 3) {
      const along = Math.min(Math.abs(track.samples[i].s - track.samples[j].s), track.length - Math.abs(track.samples[i].s - track.samples[j].s))
      if (along > 600) worst = Math.min(worst, Math.hypot(track.samples[i].x - track.samples[j].x, track.samples[i].y - track.samples[j].y))
    }
  assert(worst > track.barrier * 2, 'no two stretches of track overlap (walls never cross)')
  let maxTurn = 0
  for (let k = 0; k < n; k++) {
    const a = track.samples[k]
    const b = track.samples[(k + 20) % n]
    maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(a.tx * b.ty - a.ty * b.tx, a.tx * b.tx + a.ty * b.ty)))
  }
  assert(maxTurn > 0.5, 'it has real corners, not just a gentle oval')
  const p = sampleAt(track, 1234)
  const pr = project(track, p.x + p.nx * 30, p.y + p.ny * 30)
  assert(Math.abs(pr.s - 1234) < 8 && Math.abs(pr.offset - 30) < 2, 'projection recovers distance along the track and lateral offset')
  assert(track.sectors.length === 3 && track.pads.length >= 2, 'sector gates (anti-cheat) and boost pads exist')
}

console.log('\n== Start ==')
{
  const s = createDrive({ seed: 1, difficulty: 'normal', questions: 6 })
  assert(s.cars.length === 4 && s.cars.filter((c) => !c.isPlayer).length === 3, 'player + three rivals on the grid')
  assert(s.cars.every((c) => c.speed === 0) && !s.started, 'everyone waits on the grid')
  const before = player(s).x
  const ev = run(s, 1.5, () => GAS)
  assert(player(s).x === before, 'holding gas during the countdown does not move the car')
  assert(ev.filter((e) => e.type === 'countdown').length === 2, 'countdown ticks (3, 2)')
  const ev2 = run(s, 1.6, () => GAS)
  assert(ev2.some((e) => e.type === 'countdown') && ev2.some((e) => e.type === 'go') && s.started, '...1, GO! and the race starts')
}

console.log('\n== Car physics ==')
{
  const s = started()
  s.cars = s.cars.filter((c) => c.isPlayer)
  const me = player(s)
  const steerGas = (st: DriveState) => ({ ...botInput(st, 1), throttle: 1, brake: 0 })
  run(s, 1, steerGas)
  const v1 = me.speed
  run(s, 1, steerGas)
  assert(v1 > 50 && me.speed > v1, `accelerates with gas (${Math.round(v1)} -> ${Math.round(me.speed)})`)
  const fast = me.speed
  run(s, 0.5, () => IDLE)
  assert(me.speed < fast && me.speed > 0, 'coasting slows down gradually (momentum)')
  run(s, 1.2, () => ({ ...IDLE, brake: 1 }))
  assert(me.speed <= 10, 'braking stops the car')
  run(s, 1, () => ({ ...IDLE, brake: 1 }))
  assert(me.speed < 0, 'holding brake when stopped reverses (to recover)')
  recover(s)
  const h0 = me.heading
  run(s, 1, () => GAS)
  const hStraight = me.heading
  run(s, 0.5, () => ({ ...GAS, steer: 1 }))
  assert(Math.abs(hStraight - h0) < 0.01 && me.heading - hStraight > 0.3, 'steering turns the car (heading changes), no input keeps it straight')
  const r = createDrive({ seed: 2, difficulty: 'normal', questions: 0 })
  run(r, 3.05, () => IDLE)
  r.cars = r.cars.filter((c) => c.isPlayer)
  const car = player(r)
  const hStill = car.heading
  run(r, 0.4, () => ({ ...IDLE, steer: 1 }))
  assert(Math.abs(car.heading - hStill) < 0.001, 'a stationary car cannot spin on the spot')
}

console.log('\n== Grass and walls ==')
{
  const s = started()
  s.cars = s.cars.filter((c) => c.isPlayer)
  const me = player(s)
  const smp = track.samples[me.index]
  me.x = smp.x + smp.nx * (track.roadHalf + 40)
  me.y = smp.y + smp.ny * (track.roadHalf + 40)
  me.heading = Math.atan2(smp.ty, smp.tx)
  me.speed = 400
  me.vx = smp.tx * 400
  me.vy = smp.ty * 400
  run(s, 1.2, () => GAS)
  assert(me.speed <= GRASS_MAX + 5, `driving on the grass caps speed (${Math.round(me.speed)} <= ${GRASS_MAX})`)
  // Aim straight at the outside wall.
  const w = createDrive({ seed: 3, difficulty: 'normal', questions: 0 })
  run(w, 3.05, () => IDLE)
  w.cars = w.cars.filter((c) => c.isPlayer)
  const car = player(w)
  const sm = track.samples[car.index]
  car.heading = Math.atan2(sm.ny, sm.nx)
  car.speed = 380
  car.vx = sm.nx * 380
  car.vy = sm.ny * 380
  const ev = run(w, 1.5, () => GAS)
  const pr = project(track, car.x, car.y, car.index)
  assert(Math.abs(pr.offset) <= track.barrier + 1, 'the wall stops the car leaving the circuit')
  assert(ev.some((e) => e.type === 'bump') && w.stats.bumps > 0, 'hitting the wall is a collision (event + stat)')
  assert(car.speed < 250, 'hitting the wall costs speed')
}

console.log('\n== Laps and anti-cheat ==')
{
  // Reversing back over the start line must not count a lap.
  const s = started()
  s.cars = s.cars.filter((c) => c.isPlayer)
  const me = player(s)
  run(s, 2, () => GAS) // across the line: lap 0 begins
  assert(me.lap === 0, 'crossing the start line from the grid begins lap 1')
  for (let k = 0; k < 6; k++) {
    // Teleport-free wiggle: drive backwards over the line and forward again.
    run(s, 1.5, () => ({ ...IDLE, brake: 1 }))
    run(s, 1.5, () => GAS)
  }
  assert(me.lap === 0, 'rocking back and forth over the line never adds a lap')
  // Jumping straight to just before the line (skipping sectors) does not count either.
  const smp = sampleAt(track, track.length - 30)
  me.x = smp.x
  me.y = smp.y
  me.index = project(track, smp.x, smp.y).index
  me.s = track.length - 30
  me.heading = Math.atan2(smp.ty, smp.tx)
  me.speed = 200
  me.vx = smp.tx * 200
  me.vy = smp.ty * 200
  run(s, 1, () => GAS)
  assert(me.lap === 0, 'crossing the line without passing every sector gate does not count')
  assert(me.raceDist < track.length * 0.3, 'race distance never credits a shortcut past an unpassed sector gate')
}

console.log('\n== A full race: rivals really drive ==')
function fullRace(difficulty: DriveDifficulty, pace: number, slop: number, seed: number) {
  const s = createDrive({ seed, difficulty, questions: 8 })
  const prev = s.cars.map((c) => [c.x, c.y])
  let maxJump = 0
  const ev: DriveEvent[] = []
  for (let i = 0; i < 400 / STEP_S && !s.raceOver; i++) {
    ev.push(...stepDrive(s, botInput(s, pace, slop)))
    s.cars.forEach((c, k) => {
      maxJump = Math.max(maxJump, Math.hypot(c.x - prev[k][0], c.y - prev[k][1]))
      prev[k] = [c.x, c.y]
    })
  }
  return { s, ev, maxJump, place: placeOf(s, 'player') }
}
{
  const { s, ev, maxJump } = fullRace('normal', 1, 0, 1)
  assert(s.raceOver, 'the race finishes')
  assert(ev.filter((e) => e.type === 'finish').length >= 2, 'rivals cross the finish line themselves')
  assert(maxJump < 12, `no car ever teleports (max move per step ${maxJump.toFixed(1)})`)
  assert(ev.filter((e) => e.type === 'lap' && e.carId === 'player').length === LAPS, `the player completes ${LAPS} laps`)
  assert(ev.some((e) => e.type === 'finalLap'), 'FINAL LAP is announced')
  assert(ev.filter((e) => e.type === 'learningGate').length === 8, 'every learning gate is reached during the race')
  const st = standings(s)
  const finished = st.filter((c) => c.finishedAt !== null)
  assert(finished.every((c, i) => i === 0 || c.finishedAt! >= finished[i - 1].finishedAt!), 'finishers are ranked by finish time')
  assert(new Set(st.map((c) => c.id)).size === 4, 'every racer has exactly one final position')
  assert(s.cars.filter((c) => !c.isPlayer).every((c) => c.bestLap !== null && c.bestLap > 20), 'rival lap times are physical (no instant laps)')
}

console.log('\n== Driving skill decides the result, not answers ==')
{
  let goodPlaces = 0
  let sloppyPlaces = 0
  for (const seed of [1, 2, 3, 4]) {
    goodPlaces += fullRace('normal', 1, 0, seed).place
    sloppyPlaces += fullRace('normal', 0.85, 0.08, seed).place
  }
  assert(goodPlaces < sloppyPlaces, `better driving finishes higher with identical answers (avg ${goodPlaces / 4} vs ${sloppyPlaces / 4})`)
  const lapOf = (d: DriveDifficulty) => {
    const { s } = fullRace(d, 0.5, 0, 1)
    const r = s.cars.filter((c) => !c.isPlayer && c.bestLap !== null).map((c) => c.bestLap!)
    return Math.min(...r)
  }
  const easy = lapOf('easy')
  const hard = lapOf('hard')
  assert(hard < easy, `hard rivals lap faster than easy rivals (${hard.toFixed(1)}s vs ${easy.toFixed(1)}s)`)
}

console.log('\n== Positions move with overtakes ==')
{
  const { ev, s } = fullRace('easy', 1, 0, 2)
  assert(ev.some((e) => e.type === 'overtake'), 'the player physically overtakes rivals (overtake events)')
  assert(s.stats.overtakes > 0 && s.stats.startPlace === 4, 'starting from the back of the grid, positions are gained on track')
}

console.log('\n== Tamil answers power the boost ==')
{
  const s = started()
  assert(!canBoost(s), 'no boost before any correct answer')
  const gain = applyAnswer(s, { correct: true, points: 1400 })
  assert(gain >= 35 && s.meter >= BOOST_MIN && canBoost(s), `a correct answer charges the boost (+${gain})`)
  assert(drainEvents(s).some((e) => e.type === 'boostReady'), 'BOOST READY is announced')
  const g2 = applyAnswer(s, { correct: true, points: 1000 })
  assert(g2 > 35 || s.meter === 100, 'a streak charges more')
  const before = s.meter
  applyAnswer(s, { correct: false, points: 0 })
  assert(s.meter === before && s.streak === 0, 'a wrong answer charges nothing and resets the streak, but takes nothing away')
  s.cars = s.cars.filter((c) => c.isPlayer)
  const me = player(s)
  run(s, 3, () => GAS)
  const cruise = me.speed
  stepDrive(s, { ...GAS, boost: true })
  assert(s.boosting && s.stats.boostsUsed === 1, 'the player fires the boost themselves')
  run(s, 1.2, () => GAS)
  assert(me.speed > cruise * 1.1, `boost makes the car genuinely faster (${Math.round(cruise)} -> ${Math.round(me.speed)})`)
  assert(s.meter < before, 'boost drains the meter')
}

console.log('\n== Learning gates and slow motion ==')
{
  const gates = planLearningGates(track, 10)
  assert(gates.length === 10 && gates.every((g, i) => i === 0 || g > gates[i - 1]), 'learning gates are spread along the race in order')
  assert(gates[0] > track.length * 0.1 && gates[9] < track.length * LAPS * 0.95, 'no gate on the grid or right at the finish')
  const s = started()
  const a = player(s).s
  s.timeScale = QUESTION_TIME_SCALE
  s.autopilot = true
  run(s, 2, () => IDLE)
  const slowDist = player(s).s - a
  assert(slowDist > 0 && slowDist < 200, 'while a question is open the world slows right down and the car drives itself')
  const rival = s.cars.find((c) => !c.isPlayer)!
  const r0 = rival.raceDist
  run(s, 1, () => IDLE)
  assert(rival.raceDist - r0 < 150, 'rivals slow down too -- nobody is overtaken for reading')
}

console.log('\n== Recovery and wrong way ==')
{
  const s = started()
  s.cars = s.cars.filter((c) => c.isPlayer)
  const me = player(s)
  run(s, 2, () => GAS)
  me.heading += Math.PI
  me.speed = 120
  assert(wrongWay(s), 'driving backwards is detected (wrong-way warning)')
  recover(s)
  assert(!wrongWay(s) && me.speed === 0 && Math.abs(project(track, me.x, me.y).offset) < 2, 'reset puts the car back on the racing line facing forward')
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks - failures}/${checks} checks, ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
