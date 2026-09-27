import { mulberry32 } from '../gameplay/rng'
import { getTrack, project, sampleAt, turnAhead, type Track } from './track'

// Tamil Grand Prix driving simulation. Every racer -- the player and the
// three rivals -- is the same car model on the same track: a position,
// a heading, a speed and a velocity that slides toward the heading
// (grip), so steering, momentum, braking, grass and walls all matter.
// Rivals are driven by a look-ahead controller, never moved along a
// scripted distance, and the finishing order comes only from laps +
// sector progress + distance (then finish time) -- never from answers.
//
// Tamil questions give advantages: each correct answer charges the boost
// the player fires themselves. Learning gates are spread along the race;
// while a question is open the UI slows the whole world (timeScale) and
// the player's car drives itself, so nobody is overtaken for reading.
//
// Mutable state, fixed-step (STEP_S), no DOM -- the UI keeps it in a ref.

export const STEP_S = 1 / 60
export const LAPS = 3
export const COUNTDOWN_S = 3
export const BOOST_MIN = 25
export const QUESTION_TIME_SCALE = 0.22
const FINISH_GRACE_S = 7

export type DriveDifficulty = 'easy' | 'normal' | 'hard'

export interface CarSpec {
  maxSpeed: number
  accel: number
  brake: number
  turnRate: number
  grip: number
}

const PLAYER_SPEC: CarSpec = { maxSpeed: 430, accel: 250, brake: 560, turnRate: 2.7, grip: 7.5 }
export const GRASS_MAX = 175
export const BOOST_MULT = 1.42
const BOOST_DRAIN = 30
const PAD_BOOST_S = 1.1
export const CAR_RADIUS = 17

export interface RivalProfile {
  id: string
  name: string
  color: string
  style: 'steady' | 'sprinter' | 'late-braker'
}

export const RIVALS: RivalProfile[] = [
  { id: 'kayal', name: 'Kayal', color: '#0ea5e9', style: 'steady' },
  { id: 'mugil', name: 'Mugil', color: '#f97316', style: 'sprinter' },
  { id: 'aruvi', name: 'Aruvi', color: '#a855f7', style: 'late-braker' },
]
export const PLAYER_COLOR = '#eab308'

// Rival pace relative to the player's car, per difficulty.
const RIVAL_PACE: Record<DriveDifficulty, number> = { easy: 0.8, normal: 0.87, hard: 0.93 }
const RIVAL_CORNERING: Record<DriveDifficulty, number> = { easy: 0.8, normal: 0.87, hard: 0.94 }
const RIVAL_MISTAKE_PER_S: Record<DriveDifficulty, number> = { easy: 0.09, normal: 0.05, hard: 0.025 }

export interface DriveInput {
  throttle: number // 0..1
  brake: number // 0..1
  steer: number // -1 (left) .. 1 (right)
  boost: boolean // edge: request to fire boost
}

export interface Car {
  id: string
  name: string
  color: string
  isPlayer: boolean
  x: number
  y: number
  heading: number
  speed: number
  vx: number
  vy: number
  index: number
  s: number
  offset: number
  lap: number // laps completed
  nextSector: number
  raceDist: number
  finishedAt: number | null
  offRoad: boolean
  boostT: number // seconds of pad boost left
  // AI
  pace: number
  cornering: number
  laneOffset: number
  wobbleT: number
  wobbleDir: number
  aiBoostCharge: number
  style: RivalProfile['style']
  // Lap timing
  lapStart: number
  bestLap: number | null
}

export type DriveEvent =
  | { type: 'countdown'; n: number }
  | { type: 'go' }
  | { type: 'lap'; carId: string; lap: number; lapTime: number; best: boolean }
  | { type: 'finalLap' }
  | { type: 'overtake'; place: number; passed: string }
  | { type: 'lostPlace'; place: number }
  | { type: 'boostStart'; source: 'meter' | 'pad' }
  | { type: 'boostReady' }
  | { type: 'bump'; hard: boolean }
  | { type: 'offRoad' }
  | { type: 'learningGate'; index: number }
  | { type: 'finish'; carId: string; place: number; time: number }
  | { type: 'raceOver' }

export interface DriveState {
  track: Track
  difficulty: DriveDifficulty
  rng: () => number
  cars: Car[]
  time: number // race clock (seconds since GO; negative during countdown)
  started: boolean
  raceOver: boolean
  timeScale: number
  autopilot: boolean
  meter: number
  boosting: boolean
  streak: number
  learningGates: number[] // race distances
  nextGate: number
  playerPlace: number
  finishOrder: string[]
  playerFinishedAt: number | null
  overGrace: number
  stats: {
    boostsUsed: number
    overtakes: number
    bumps: number
    offRoadTime: number
    topSpeed: number
    correct: number
    answered: number
    bestStreak: number
    startPlace: number
    worstPlace: number
    cleanLaps: number
  }
  lapClean: boolean
  lastCountdown: number
  events: DriveEvent[]
  contacts: Set<string>
}

function makeCar(track: Track, p: { id: string; name: string; color: string; isPlayer: boolean; style: RivalProfile['style'] }, gridSlot: number, difficulty: DriveDifficulty, rng: () => number): Car {
  // Grid: two columns, staggered, behind the start line.
  const back = 55 + gridSlot * 48
  const side = gridSlot % 2 === 0 ? 30 : -30
  const smp = sampleAt(track, track.length - back)
  const x = smp.x + smp.nx * side
  const y = smp.y + smp.ny * side
  const pr = project(track, x, y)
  const stylePace = p.style === 'sprinter' ? 1.02 : p.style === 'late-braker' ? 0.99 : 1
  const styleCorner = p.style === 'late-braker' ? 1.06 : p.style === 'sprinter' ? 0.94 : 1
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    isPlayer: p.isPlayer,
    x,
    y,
    heading: Math.atan2(smp.ty, smp.tx),
    speed: 0,
    vx: 0,
    vy: 0,
    index: pr.index,
    s: pr.s,
    offset: pr.offset,
    lap: -1, // the grid is behind the line: crossing it starts lap 1 (lap = 0 completed)
    nextSector: 3,
    raceDist: -back,
    finishedAt: null,
    offRoad: false,
    boostT: 0,
    pace: p.isPlayer ? 1 : RIVAL_PACE[difficulty] * stylePace * (0.99 + rng() * 0.02),
    cornering: p.isPlayer ? 1 : RIVAL_CORNERING[difficulty] * styleCorner,
    laneOffset: (rng() - 0.5) * 40,
    wobbleT: 0,
    wobbleDir: 1,
    aiBoostCharge: 0,
    style: p.style,
    lapStart: 0,
    bestLap: null,
  }
}

export function planLearningGates(track: Track, count: number): number[] {
  const race = track.length * LAPS
  const start = track.length * 0.12
  const end = race * 0.93
  const gates: number[] = []
  for (let k = 0; k < count; k++) gates.push(start + ((k + 0.5) / Math.max(1, count)) * (end - start))
  return gates
}

export function createDrive({ seed, difficulty, questions }: { seed: number; difficulty: DriveDifficulty; questions: number }): DriveState {
  const track = getTrack()
  const rng = mulberry32(seed)
  // The player starts at the back of the grid: there is racing to do.
  const racers = [...RIVALS.map((r) => ({ ...r, isPlayer: false })), { id: 'player', name: 'You', color: PLAYER_COLOR, isPlayer: true, style: 'steady' as const }]
  const cars = racers.map((r, i) => makeCar(track, r, i, difficulty, rng))
  const state: DriveState = {
    track,
    difficulty,
    rng,
    cars,
    time: -COUNTDOWN_S,
    started: false,
    raceOver: false,
    timeScale: 1,
    autopilot: false,
    meter: 0,
    boosting: false,
    streak: 0,
    learningGates: planLearningGates(track, questions),
    nextGate: 0,
    playerPlace: 4,
    finishOrder: [],
    playerFinishedAt: null,
    overGrace: 0,
    stats: { boostsUsed: 0, overtakes: 0, bumps: 0, offRoadTime: 0, topSpeed: 0, correct: 0, answered: 0, bestStreak: 0, startPlace: 4, worstPlace: 4, cleanLaps: 0 },
    lapClean: true,
    lastCountdown: COUNTDOWN_S + 1,
    events: [],
    contacts: new Set(),
  }
  state.playerPlace = placeOf(state, 'player')
  return state
}

export function player(s: DriveState): Car {
  return s.cars.find((c) => c.isPlayer)!
}

export function standings(s: DriveState): Car[] {
  return [...s.cars].sort((a, b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt
    if (a.finishedAt !== null) return -1
    if (b.finishedAt !== null) return 1
    return b.raceDist - a.raceDist
  })
}

export function placeOf(s: DriveState, id: string): number {
  return standings(s).findIndex((c) => c.id === id) + 1
}

export function kmh(speed: number): number {
  return Math.round(Math.abs(speed) * 0.45)
}

// ---------------------------------------------------------------------
// Car model

function angleDiff(a: number, b: number): number {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function aiInput(s: DriveState, car: Car, dt: number, forPlayer = false): DriveInput {
  const track = s.track
  const pace = forPlayer ? (car.finishedAt !== null ? 0.45 : 0.62) : car.pace
  const look = 70 + Math.abs(car.speed) * 0.42
  const target = sampleAt(track, car.s + look)
  let lane = forPlayer ? 0 : car.laneOffset
  // Traffic: pull out to pass a slower car just ahead.
  const hx = Math.cos(car.heading)
  const hy = Math.sin(car.heading)
  for (const o of s.cars) {
    if (o === car) continue
    const dx = o.x - car.x
    const dy = o.y - car.y
    const ahead = dx * hx + dy * hy
    const side = -dx * hy + dy * hx
    if (ahead > 0 && ahead < 120 && Math.abs(side) < CAR_RADIUS * 2.4 && o.speed < car.speed + 20) {
      const pass = o.offset > 0 ? -1 : 1
      lane = Math.max(-track.roadHalf + 22, Math.min(track.roadHalf - 22, o.offset + pass * 46))
      break
    }
  }
  const tx = target.x + target.nx * lane
  const ty = target.y + target.ny * lane
  const want = Math.atan2(ty - car.y, tx - car.x)
  let steer = Math.max(-1, Math.min(1, angleDiff(car.heading, want) * 2.4))
  // Occasional mistakes: a short wobble off the line.
  if (!forPlayer) {
    if (car.wobbleT > 0) {
      car.wobbleT -= dt
      steer = Math.max(-1, Math.min(1, steer + 0.55 * car.wobbleDir))
    } else if (s.rng() < RIVAL_MISTAKE_PER_S[s.difficulty] * dt) {
      car.wobbleT = 0.35 + s.rng() * 0.4
      car.wobbleDir = s.rng() < 0.5 ? -1 : 1
    }
  }
  // Brake for what's coming.
  const bend = Math.max(turnAhead(track, car.s, 40, 200), turnAhead(track, car.s, 150, 200) * 0.85)
  const cornerCap = PLAYER_SPEC.maxSpeed * (1 - Math.min(0.62, bend * 0.62 / car.cornering))
  const targetSpeed = Math.min(PLAYER_SPEC.maxSpeed * pace, cornerCap * (forPlayer ? 0.9 : Math.min(1, pace + 0.04)))
  const throttle = car.speed < targetSpeed ? 1 : 0
  const brake = car.speed > targetSpeed + 25 ? Math.min(1, (car.speed - targetSpeed) / 120) : 0
  return { throttle, brake, steer, boost: false }
}

function stepCar(s: DriveState, car: Car, input: DriveInput, dt: number, boostMult: number) {
  const track = s.track
  const spec = PLAYER_SPEC
  const pr = project(track, car.x, car.y, car.index)
  car.index = pr.index
  const absOff = Math.abs(pr.offset)
  const wasOff = car.offRoad
  car.offRoad = absOff > track.roadHalf
  if (car.isPlayer && car.offRoad && s.started) {
    s.lapClean = false
    if (!wasOff) s.events.push({ type: 'offRoad' })
  }
  const pad = car.boostT > 0
  const mult = (pad ? 1.28 : 1) * boostMult
  const max = (car.offRoad ? GRASS_MAX : spec.maxSpeed * (car.isPlayer ? 1 : car.pace > 1 ? car.pace : 1)) * mult
  const accel = spec.accel * (mult > 1 ? 1.7 : 1) * (car.offRoad ? 0.7 : 1)

  if (input.throttle > 0 && car.speed >= -5) {
    car.speed += accel * input.throttle * dt * Math.max(0.15, 1 - car.speed / max)
  }
  if (input.brake > 0) {
    if (car.speed > 10) car.speed -= spec.brake * input.brake * dt
    else car.speed = Math.max(-110, car.speed - 160 * input.brake * dt) // reverse to recover
  }
  if (input.throttle === 0 && input.brake === 0) {
    const coast = 70 + Math.abs(car.speed) * 0.25
    car.speed = car.speed > 0 ? Math.max(0, car.speed - coast * dt) : Math.min(0, car.speed + coast * dt)
  }
  if (car.speed > max) car.speed = Math.max(max, car.speed - (car.offRoad ? 520 : 260) * dt)

  // Steering: needs rolling speed; a little less bite at top speed.
  const roll = Math.min(1, Math.abs(car.speed) / 120)
  const bite = 1 - 0.3 * Math.min(1, Math.abs(car.speed) / spec.maxSpeed)
  car.heading += input.steer * spec.turnRate * bite * roll * dt * (car.speed < 0 ? -1 : 1)

  // Velocity slides toward the heading (grip) -> momentum and drift.
  const grip = (car.offRoad ? 3 : spec.grip) * dt
  const wx = Math.cos(car.heading) * car.speed
  const wy = Math.sin(car.heading) * car.speed
  car.vx += (wx - car.vx) * Math.min(1, grip)
  car.vy += (wy - car.vy) * Math.min(1, grip)
  car.x += car.vx * dt
  car.y += car.vy * dt

  // Walls.
  const after = project(track, car.x, car.y, car.index)
  if (Math.abs(after.offset) > track.barrier) {
    const smp = track.samples[after.index]
    const sign = after.offset > 0 ? 1 : -1
    const push = Math.abs(after.offset) - track.barrier + 2
    car.x -= smp.nx * sign * push
    car.y -= smp.ny * sign * push
    // Kill the outward velocity, scrub speed, turn the nose along the wall.
    const out = car.vx * smp.nx * sign + car.vy * smp.ny * sign
    if (out > 0) {
      car.vx -= smp.nx * sign * out * 1.3
      car.vy -= smp.ny * sign * out * 1.3
    }
    const hard = Math.abs(car.speed) > 220
    car.speed *= 0.55
    const along = Math.atan2(smp.ty, smp.tx)
    car.heading += angleDiff(car.heading, Math.abs(angleDiff(car.heading, along)) < Math.PI / 2 ? along : along + Math.PI) * 0.35
    if (car.isPlayer) s.lapClean = false
    if (car.isPlayer && Math.abs(car.speed) > 40) {
      s.stats.bumps++
      s.events.push({ type: 'bump', hard })
    }
  }
  const fin = project(track, car.x, car.y, car.index)
  car.index = fin.index
  updateProgress(s, car, fin.s)
  car.offset = fin.offset

  // Boost pads.
  if (!car.offRoad) {
    for (const p of track.pads) {
      let ds = car.s - p.s
      if (ds < -track.length / 2) ds += track.length
      if (ds >= 0 && ds < p.length && Math.abs(car.offset - p.offset) < p.halfWidth + 6) {
        if (car.boostT <= 0 && car.isPlayer) s.events.push({ type: 'boostStart', source: 'pad' })
        car.boostT = PAD_BOOST_S
      }
    }
  }
  if (car.boostT > 0) car.boostT -= dt
}

// Lap / sector bookkeeping. Sectors must be passed in order (0.25, 0.5,
// 0.75 of the lap) before crossing the line counts: cutting back across
// the line or reversing over it never adds a lap.
function updateProgress(s: DriveState, car: Car, newS: number) {
  const L = s.track.length
  const prevS = car.s
  car.s = newS
  const sectors = s.track.sectors
  if (car.nextSector < sectors.length) {
    const gate = sectors[car.nextSector] * L
    if (prevS < gate && newS >= gate && newS - prevS < L / 2) car.nextSector++
  }
  const crossedLine = prevS > L * 0.8 && newS < L * 0.2
  if (crossedLine && car.nextSector >= sectors.length) {
    car.lap++
    car.nextSector = 0
    if (car.lap >= 1) {
      const lapTime = s.time - car.lapStart
      const best = car.bestLap === null || lapTime < car.bestLap
      if (best) car.bestLap = lapTime
      if (car.isPlayer) {
        if (s.lapClean) s.stats.cleanLaps++
        s.lapClean = true
      }
      s.events.push({ type: 'lap', carId: car.id, lap: car.lap, lapTime, best })
      if (car.isPlayer && car.lap === LAPS - 1) s.events.push({ type: 'finalLap' })
    }
    car.lapStart = s.time
    if (car.isPlayer && car.lap === 0) s.lapClean = true
    if (car.lap >= LAPS && car.finishedAt === null) {
      car.finishedAt = s.time
      s.finishOrder.push(car.id)
      s.events.push({ type: 'finish', carId: car.id, place: s.finishOrder.length, time: s.time })
      if (car.isPlayer) s.playerFinishedAt = s.time
    }
  }
  // Race distance: laps completed + distance into the current lap, but
  // never beyond the next sector gate not yet reached (no shortcut gain).
  let into = newS
  if (car.nextSector < sectors.length) into = Math.min(newS, sectors[car.nextSector] * L + 40)
  if (car.finishedAt !== null) car.raceDist = LAPS * L
  else if (car.lap < 0) car.raceDist = newS > L / 2 ? newS - L : 0 // still on the grid, behind the line
  else car.raceDist = car.lap * L + into
}

function collide(s: DriveState) {
  const cars = s.cars
  const touching = new Set<string>()
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i]
      const b = cars[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy)
      const min = CAR_RADIUS * 2
      if (d > 0 && d < min) {
        const nx = dx / d
        const ny = dy / d
        const push = (min - d) / 2
        a.x -= nx * push
        a.y -= ny * push
        b.x += nx * push
        b.y += ny * push
        // The car behind loses a little speed; the one ahead keeps most.
        const aBehind = a.vx * nx + a.vy * ny > 0
        if (aBehind) a.speed *= 0.93
        else b.speed *= 0.93
        const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
        touching.add(key)
        if ((a.isPlayer || b.isPlayer) && !s.contacts.has(key)) {
          s.stats.bumps++
          s.events.push({ type: 'bump', hard: false })
        }
      }
    }
  }
  s.contacts = touching
}

// Advances the race by one fixed step. `input` is the player's controls.
export function stepDrive(s: DriveState, input: DriveInput): DriveEvent[] {
  if (s.raceOver) return drainEvents(s)
  const dt = STEP_S * s.timeScale
  s.time += dt

  if (!s.started) {
    const n = Math.ceil(-s.time)
    if (n < s.lastCountdown && n > 0) {
      s.lastCountdown = n
      s.events.push({ type: 'countdown', n })
    }
    if (s.time >= 0) {
      s.started = true
      s.time = 0
      for (const c of s.cars) c.lapStart = 0
      s.events.push({ type: 'go' })
    }
    return drainEvents(s)
  }

  const me = player(s)
  // Player boost from the meter.
  if (input.boost && !s.boosting && s.meter >= BOOST_MIN && me.finishedAt === null) {
    s.boosting = true
    s.stats.boostsUsed++
    s.events.push({ type: 'boostStart', source: 'meter' })
  }
  if (s.boosting) {
    s.meter = Math.max(0, s.meter - BOOST_DRAIN * dt)
    if (s.meter <= 0) s.boosting = false
  }

  for (const car of s.cars) {
    let inp: DriveInput
    let boostMult = 1
    if (car.isPlayer) {
      inp = s.autopilot || car.finishedAt !== null ? aiInput(s, car, dt, true) : input
      if (s.boosting) boostMult = BOOST_MULT
    } else {
      inp = car.finishedAt !== null ? { ...aiInput(s, car, dt), throttle: 0.3 } : aiInput(s, car, dt)
      // Rivals charge their own boost over time and fire it on straights.
      car.aiBoostCharge += dt * (s.difficulty === 'hard' ? 0.05 : s.difficulty === 'normal' ? 0.035 : 0.02)
      if (car.aiBoostCharge >= 1 && turnAhead(s.track, car.s, 0, 400) < 0.35) {
        car.aiBoostCharge = 0
        car.boostT = 1.6
      }
    }
    stepCar(s, car, inp, dt, boostMult)
  }
  collide(s)

  // Player stats, learning gates, places.
  if (me.offRoad && s.started) s.stats.offRoadTime += dt
  s.stats.topSpeed = Math.max(s.stats.topSpeed, kmh(me.speed))
  while (s.nextGate < s.learningGates.length && me.raceDist >= s.learningGates[s.nextGate]) {
    s.events.push({ type: 'learningGate', index: s.nextGate })
    s.nextGate++
  }
  const place = placeOf(s, 'player')
  if (place < s.playerPlace && me.finishedAt === null) {
    const passed = standings(s)[place]?.name ?? ''
    s.stats.overtakes += s.playerPlace - place
    s.events.push({ type: 'overtake', place, passed })
  } else if (place > s.playerPlace && me.finishedAt === null) {
    s.events.push({ type: 'lostPlace', place })
  }
  s.playerPlace = place
  s.stats.worstPlace = Math.max(s.stats.worstPlace, place)

  // The race ends once everyone is home, or a grace period after the
  // player finishes (remaining rivals are ranked by distance covered).
  if (me.finishedAt !== null) {
    s.overGrace += dt
    if (s.cars.every((c) => c.finishedAt !== null) || s.overGrace >= FINISH_GRACE_S) {
      s.raceOver = true
      s.events.push({ type: 'raceOver' })
    }
  }
  return drainEvents(s)
}

// A graded answer from the server feeds the boost meter. Faster answers
// and streaks charge more; a wrong answer charges nothing but costs no
// speed -- the race stays winnable.
export function applyAnswer(s: DriveState, res: { correct: boolean; points: number }): number {
  s.stats.answered++
  if (!res.correct) {
    s.streak = 0
    return 0
  }
  s.stats.correct++
  s.streak++
  s.stats.bestStreak = Math.max(s.stats.bestStreak, s.streak)
  const speedBonus = Math.max(0, Math.min(15, Math.round(((res.points - 1000) / 500) * 15)))
  const combo = Math.min(20, (s.streak - 1) * 5)
  const gain = 35 + speedBonus + combo
  const before = s.meter
  s.meter = Math.min(100, s.meter + gain)
  if (before < BOOST_MIN && s.meter >= BOOST_MIN) s.events.push({ type: 'boostReady' })
  return s.meter - before
}

export function canBoost(s: DriveState): boolean {
  return s.started && !s.boosting && s.meter >= BOOST_MIN && player(s).finishedAt === null
}

// Puts a stuck/turned-around car back on the centreline at its current
// distance, facing the right way (keyboard R / touch Reset).
export function recover(s: DriveState, car: Car = player(s)) {
  const smp = s.track.samples[car.index]
  car.x = smp.x
  car.y = smp.y
  car.heading = Math.atan2(smp.ty, smp.tx)
  car.speed = 0
  car.vx = 0
  car.vy = 0
}

// True while the player is pointing clearly the wrong way.
export function wrongWay(s: DriveState): boolean {
  const me = player(s)
  if (Math.abs(me.speed) < 40 || !s.started) return false
  const smp = s.track.samples[me.index]
  return Math.cos(me.heading) * smp.tx + Math.sin(me.heading) * smp.ty < -0.3
}

// Events raised since the last drain (stepDrive drains automatically;
// call this after applyAnswer / recover outside the loop).
export function drainEvents(s: DriveState): DriveEvent[] {
  const e = s.events
  s.events = []
  return e
}

// The rival controller driving the player's car at a chosen pace --
// used by the mechanics tests to play whole races (a "good" and a
// "sloppy" driver) through exactly the same physics as a person.
export function botInput(s: DriveState, pace: number, sloppiness = 0): DriveInput {
  const me = player(s)
  const saved = me.pace
  const savedCorner = me.cornering
  me.pace = pace
  me.cornering = pace
  const inp = aiInput(s, me, STEP_S * s.timeScale)
  me.pace = saved
  me.cornering = savedCorner
  if (sloppiness > 0 && s.rng() < sloppiness) inp.steer = Math.max(-1, Math.min(1, inp.steer + (s.rng() - 0.5) * 2.4))
  return inp
}
