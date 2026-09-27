import { mulberry32 } from '../gameplay/rng'
import { buildRoad, curveAhead, segmentAt, straightAhead, SEGMENT_LENGTH, ROAD_WIDTH, RAIL_OFFSET, type Road } from './road'
import { getTrack, type TrackDef } from './tracks'
import { POWERS, POWER_SLOTS, awardPower, type PowerId } from './powerups'

// Tamil Grand Prix race simulation (solo): the player and three rivals on
// a pseudo-3D road. Mutable state, fixed step (STEP), no DOM, no React --
// the UI keeps it in a ref and renders it (components/gameRoomV2/racing3d).
//
// Driving skill decides the race: acceleration, braking, momentum,
// arcade handling (see HANDLING below), drift on bends, off-road slowdown,
// crashes into roadside scenery and bumps with other cars.
//
// Road convention (shared with the renderer): x > 0 is the right of the
// road, curve > 0 bends right, so a bend's outside is -sign(curve).
//
// Tamil questions come at CHECKPOINTS: crossing one freezes the whole race
// (nobody gains or loses while reading), the answer is graded by the
// SERVER, a correct answer awards a power-up the player fires later, and a
// 3-2-1 countdown resumes the race. Rivals are simulation-only: they have
// no accounts, earn nothing and never appear in any record.

export const STEP = 1 / 60
export const LAPS = 3
export const MAX_SPEED = SEGMENT_LENGTH / STEP // world units per second at full throttle
export const COUNTDOWN_S = 3
export const RESUME_S = 3
export const CHECKPOINTS_PER_LAP = 2
export const MAX_RACE_CHECKPOINTS = LAPS * CHECKPOINTS_PER_LAP
export const KMH_AT_MAX = 220

const ACCEL = MAX_SPEED / 4.2
const BRAKING = -MAX_SPEED / 1.15
const DECEL = -MAX_SPEED / 6
const OFFROAD_DECEL = -MAX_SPEED / 1.7
const OFFROAD_LIMIT = MAX_SPEED / 3.2
export const BOOST_MULT = 1.32
const BURST_MULT = 1.2
export const CAR_HALF = 0.17
const FINISH_GRACE_S = 9
const X_LIMIT = 3.2

// Arcade handling. The car moves across the road with a lateral velocity
// (road half-widths per second) that chases a target set by the steering
// and the bend; a short time constant gives it weight without lag.
//   authority: how fast full lock moves the car sideways. Strong at all
//     normal speeds, eased only above ~55% speed (never below 80%), and at
//     low speed limited by the car's heading angle (a car cannot slide
//     sideways when stopped, but at 45 km/h it turns easily).
//   drift: a bend pushes the car to its outside with speed^2, a little
//     more than proportionally in the tightest bends. At normal top speed
//     every bend on every track needs well under full lock, so the road can
//     always be followed; boosting into the sharpest ones needs a lift or a
//     dab of brake, and a true hairpin rewards braking.
//   steering input is rate-limited (keyboard taps become smooth ramps,
//   returning to centre faster than building up) so left-right swaps
//   never jerk. All of it integrates the same at 30, 60 or 120 Hz.
export const HANDLING = {
  steerRate: 2.5, // half-widths/s at full lock (below the high-speed ease)
  highSpeedEase: 0.2, // authority lost at 130% speed
  maxSlip: 1.0, // tan of the largest heading angle to the road (45 deg)
  drift: 0.2, // half-widths/s per unit curve at top speed
  tightFrom: 3.5, // bends sharper than this push harder...
  tightGain: 0.25, // ...by this much per unit of extra curve
  tauRoad: 0.08, // lateral response time on tarmac (s)
  tauGrass: 0.2, // ... and on grass
  steerBuild: 1 / 0.11, // steering input ramp (per second) towards lock
  steerReturn: 1 / 0.06, // ... and back to centre / reversing
}

export type Difficulty = 'easy' | 'normal' | 'hard'
export type Personality = 'smooth' | 'aggressive' | 'steady'

export interface RivalDef {
  id: string
  name: string
  tamilName: string
  color: string
  personality: Personality
  blurb: string
}

export const RIVALS: RivalDef[] = [
  { id: 'kayal', name: 'Kayal', tamilName: 'கயல்', color: '#0ea5e9', personality: 'smooth', blurb: 'சீரான ஓட்டம்; வளைவுகளில் நிபுணர்' },
  { id: 'mugil', name: 'Mugil', tamilName: 'முகில்', color: '#f97316', personality: 'aggressive', blurb: 'அதிவேகம்; துணிச்சலான முந்துதல்' },
  { id: 'aruvi', name: 'Aruvi', tamilName: 'அருவி', color: '#a855f7', personality: 'steady', blurb: 'நிதானம்; நேர்ச் சாலையில் பாய்ச்சல்' },
]
export const PLAYER_COLOR = '#eab308'

// How each rival drives (fractions of the player car's top speed etc.).
export const PERSONA: Record<Personality, { top: number; corner: number; line: number; weave: number; mistake: number; straightBoost: boolean; runsWide: number }> = {
  smooth: { top: 0.955, corner: 0.95, line: 0.45, weave: 0.15, mistake: 0.4, straightBoost: false, runsWide: 0 },
  aggressive: { top: 1.0, corner: 0.78, line: 0.1, weave: 0.9, mistake: 1.1, straightBoost: false, runsWide: 0.45 },
  steady: { top: 0.93, corner: 0.98, line: 0, weave: 0.2, mistake: 0.25, straightBoost: true, runsWide: 0 },
}

export const DIFFICULTY: Record<Difficulty, { pace: number; mistakesPerS: number; catchUp: number }> = {
  easy: { pace: 0.9, mistakesPerS: 0.09, catchUp: 1.04 },
  normal: { pace: 1.0, mistakesPerS: 0.05, catchUp: 1.06 },
  hard: { pace: 1.07, mistakesPerS: 0.025, catchUp: 1.08 },
}

export interface Car {
  id: string
  name: string
  tamilName: string
  color: string
  isPlayer: boolean
  personality: Personality | null
  z: number // total distance from the start line
  x: number // road half-widths from the centre
  speed: number
  vx: number // lateral velocity from steering and bends, half-widths/s
  kick: number // lateral velocity from knocks (bumps, rails), fading
  yaw: number // heading relative to the road (rad, + = pointing right)
  steer: number // smoothed steering, -1..1
  pz: number // z / x / yaw before the latest step (render interpolation)
  px: number
  pyaw: number
  lap: number // completed laps
  finished: boolean
  finishTime: number | null
  boostT: number
  shieldT: number
  gripT: number
  magnetT: number
  starT: number
  burstT: number
  crashT: number
  railT: number // guard-rail scrape cooldown
  lapStart: number
  bestLap: number | null
  // Rival brain.
  aiTargetX: number
  aiMistakeT: number
  aiBoostCd: number
  // Bumped from behind: move over to this lane for a moment.
  aiYieldT: number
  aiYieldX: number
}

export interface Coin {
  z: number // within the lap
  x: number
}

export type RaceStatus = 'countdown' | 'racing' | 'question' | 'resume' | 'finished'

export type RaceEvent =
  | { type: 'count'; n: number }
  | { type: 'go' }
  | { type: 'checkpoint'; index: number }
  | { type: 'resumeGo' }
  | { type: 'lap'; lap: number; time: number; best: boolean }
  | { type: 'finalLap' }
  | { type: 'finish'; place: number; time: number }
  | { type: 'raceOver' }
  | { type: 'bump' }
  | { type: 'crash' }
  | { type: 'rail' }
  | { type: 'shieldHit' }
  | { type: 'offroad' }
  | { type: 'coin'; total: number }
  | { type: 'overtake'; place: number }
  | { type: 'overtaken'; place: number }
  | { type: 'power'; id: PowerId }
  | { type: 'rivalBoost'; id: string }

export interface RaceStats {
  coins: number
  overtakes: number
  bumps: number
  crashes: number
  powersUsed: number
  topSpeed: number // km/h
  offroadTime: number
  lapTimes: number[]
  cleanLaps: number
  bestPlace: number
  worstPlace: number
  checkpointsAnswered: number
  checkpointsCorrect: number
}

export interface RaceState {
  track: TrackDef
  road: Road
  difficulty: Difficulty
  laps: number
  raceLength: number
  cars: Car[] // [0] is the player
  status: RaceStatus
  time: number // racing seconds (frozen during questions)
  countdown: number
  resumeT: number
  checkpoints: number[] // absolute distances
  nextCheckpoint: number
  slots: PowerId[]
  coins: Coin[]
  taken: Set<number> // lap * 10000 + coin index
  stats: RaceStats
  streak: number
  place: number
  over: boolean
  finishGrace: number
  lapOffroad: number
  lapCrashed: boolean
  wasOffroad: boolean
  rand: () => number
}

export interface RaceInput {
  throttle: number // 0..1
  brake: number // 0..1
  steer: number // -1..1
  usePower: boolean // edge-triggered
}

export const IDLE: RaceInput = { throttle: 0, brake: 0, steer: 0, usePower: false }

function newCar(id: string, name: string, tamilName: string, color: string, isPlayer: boolean, personality: Personality | null, z: number, x: number): Car {
  return {
    id, name, tamilName, color, isPlayer, personality, z, x, speed: 0, vx: 0, kick: 0, yaw: 0, steer: 0, pz: z, px: x, pyaw: 0, lap: 0, finished: false, finishTime: null,
    boostT: 0, shieldT: 0, gripT: 0, magnetT: 0, starT: 0, burstT: 0, crashT: 0, railT: 0, lapStart: 0, bestLap: null,
    aiTargetX: x, aiMistakeT: 0, aiBoostCd: 6, aiYieldT: 0, aiYieldX: x,
  }
}

// Where the question checkpoints go: up to two per lap, at ~38% and ~78%
// of the lap, spread evenly when there are fewer questions than slots.
export function planCheckpoints(lapLength: number, laps: number, questions: number): number[] {
  const slots: number[] = []
  for (let l = 0; l < laps; l++) for (const f of [0.38, 0.78]) slots.push((l + f) * lapLength)
  const n = Math.max(0, Math.min(questions, slots.length))
  if (n === slots.length) return slots
  const out: number[] = []
  for (let k = 0; k < n; k++) out.push(slots[Math.min(slots.length - 1, Math.floor(((k + 0.5) / n) * slots.length))])
  return out
}

function planCoins(road: Road, rand: () => number): Coin[] {
  const coins: Coin[] = []
  const n = road.segments.length
  for (let i = 40; i < n - 30; i += 55 + Math.floor(rand() * 40)) {
    const lane = [-0.6, 0, 0.6][Math.floor(rand() * 3)]
    const drift = Math.abs(road.segments[i].curve) > 2 ? -Math.sign(road.segments[i].curve) * 0.2 : 0
    for (let k = 0; k < 5; k++) coins.push({ z: (i + k * 3) * SEGMENT_LENGTH, x: lane + drift })
  }
  return coins
}

export function createRace({ trackId, difficulty, seed, questions }: { trackId: string; difficulty: Difficulty; seed: number; questions: number }): RaceState {
  const track = getTrack(trackId)
  const road = buildRoad(track)
  const rand = mulberry32(seed)
  const g = SEGMENT_LENGTH * 2.2
  // Grid: the rivals start ahead so there is a race to win.
  const cars: Car[] = [
    newCar('player', 'You', 'நீங்கள்', PLAYER_COLOR, true, null, 0, 0.3),
    newCar(RIVALS[2].id, RIVALS[2].name, RIVALS[2].tamilName, RIVALS[2].color, false, RIVALS[2].personality, g, -0.35),
    newCar(RIVALS[0].id, RIVALS[0].name, RIVALS[0].tamilName, RIVALS[0].color, false, RIVALS[0].personality, g * 2, 0.35),
    newCar(RIVALS[1].id, RIVALS[1].name, RIVALS[1].tamilName, RIVALS[1].color, false, RIVALS[1].personality, g * 3, -0.35),
  ]
  const lapLength = road.lapLength
  return {
    track, road, difficulty, laps: LAPS, raceLength: lapLength * LAPS, cars,
    status: 'countdown', time: 0, countdown: COUNTDOWN_S, resumeT: 0,
    checkpoints: planCheckpoints(lapLength, LAPS, questions), nextCheckpoint: 0,
    slots: [], coins: planCoins(road, rand), taken: new Set(),
    stats: { coins: 0, overtakes: 0, bumps: 0, crashes: 0, powersUsed: 0, topSpeed: 0, offroadTime: 0, lapTimes: [], cleanLaps: 0, bestPlace: 4, worstPlace: 4, checkpointsAnswered: 0, checkpointsCorrect: 0 },
    streak: 0, place: 4, over: false, finishGrace: 0, lapOffroad: 0, lapCrashed: false, wasOffroad: false, rand,
  }
}

export const player = (s: RaceState) => s.cars[0]
export const kmh = (speed: number) => Math.round((speed / MAX_SPEED) * KMH_AT_MAX)
export const boosting = (c: Car) => c.boostT > 0 || c.starT > 0 || c.burstT > 0
export const shielded = (c: Car) => c.shieldT > 0 || c.starT > 0

// Finishers by time, then everyone else by distance.
export function standings(s: RaceState): Car[] {
  return [...s.cars].sort((a, b) => {
    if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0)
    if (a.finished) return -1
    if (b.finished) return 1
    return b.z - a.z
  })
}
export const placeOf = (s: RaceState, id: string) => standings(s).findIndex((c) => c.id === id) + 1

// ---------------------------------------------------------------------------

export function stepRace(s: RaceState, input: RaceInput, dt = STEP): RaceEvent[] {
  const ev: RaceEvent[] = []
  // Remember where everyone was, so the renderer can interpolate between
  // steps (smooth motion at any refresh rate) -- and hold still when frozen.
  for (const c of s.cars) {
    c.pz = c.z
    c.px = c.x
    c.pyaw = c.yaw
  }
  if (s.over || s.status === 'question') return ev

  if (s.status === 'countdown' || s.status === 'resume') {
    const before = Math.ceil(s.status === 'countdown' ? s.countdown : s.resumeT)
    if (s.status === 'countdown') s.countdown -= dt
    else s.resumeT -= dt
    const left = s.status === 'countdown' ? s.countdown : s.resumeT
    const now = Math.ceil(left)
    if (now !== before && now > 0) ev.push({ type: 'count', n: now })
    if (left <= 0) {
      ev.push({ type: s.status === 'countdown' ? 'go' : 'resumeGo' })
      s.status = s.cars[0].finished ? 'finished' : 'racing'
    }
    return ev
  }

  s.time += dt
  const p = s.cars[0]
  if (!p.finished) stepPlayer(s, p, input, dt, ev)
  for (let i = 1; i < s.cars.length; i++) if (!s.cars[i].finished) stepRival(s, s.cars[i], dt, ev)
  for (const c of s.cars) tickTimers(c, dt)

  // Places and overtakes.
  const place = placeOf(s, 'player')
  if (!p.finished && place !== s.place) {
    if (place < s.place) {
      s.stats.overtakes++
      ev.push({ type: 'overtake', place })
    } else ev.push({ type: 'overtaken', place })
  }
  s.place = place
  s.stats.bestPlace = Math.min(s.stats.bestPlace, place)
  if (s.time > 5) s.stats.worstPlace = Math.max(s.stats.worstPlace, place)

  // Checkpoint: freeze the race for a question.
  if (!p.finished && s.nextCheckpoint < s.checkpoints.length && p.z >= s.checkpoints[s.nextCheckpoint]) {
    ev.push({ type: 'checkpoint', index: s.nextCheckpoint })
    s.nextCheckpoint++
    s.status = 'question'
    return ev
  }

  // After the player finishes, give the rivals a little time, then settle.
  if (p.finished) {
    s.finishGrace += dt
    const allDone = s.cars.every((c) => c.finished)
    if (allDone || s.finishGrace >= FINISH_GRACE_S) {
      for (const c of s.cars) {
        if (c.finished) continue
        c.finished = true
        c.finishTime = s.time + (s.raceLength - c.z) / Math.max(c.speed, MAX_SPEED * 0.5)
      }
      s.over = true
      ev.push({ type: 'raceOver' })
    }
  }
  return ev
}

function tickTimers(c: Car, dt: number) {
  c.boostT = Math.max(0, c.boostT - dt)
  c.shieldT = Math.max(0, c.shieldT - dt)
  c.gripT = Math.max(0, c.gripT - dt)
  c.magnetT = Math.max(0, c.magnetT - dt)
  c.starT = Math.max(0, c.starT - dt)
  c.burstT = Math.max(0, c.burstT - dt)
  c.crashT = Math.max(0, c.crashT - dt)
  c.railT = Math.max(0, c.railT - dt)
  c.aiMistakeT = Math.max(0, c.aiMistakeT - dt)
  c.aiBoostCd = Math.max(0, c.aiBoostCd - dt)
  c.aiYieldT = Math.max(0, c.aiYieldT - dt)
}

function topSpeed(c: Car): number {
  return MAX_SPEED * (c.boostT > 0 || c.starT > 0 ? BOOST_MULT : c.burstT > 0 ? BURST_MULT : 1)
}

// Fraction of the way a first-order response covers in dt (exact for any
// step length, so 30/60/120 Hz integrate alike).
const approach = (dt: number, tau: number) => 1 - Math.pow(Math.E, -dt / tau)

// Smooth the raw steering input: ramps towards lock, snaps back faster.
export function smoothSteer(current: number, target: number, dt: number): number {
  const t = Math.max(-1, Math.min(1, target))
  const releasing = Math.abs(t) < Math.abs(current) || Math.sign(t) !== Math.sign(current)
  const rate = (releasing && current !== 0 ? HANDLING.steerReturn : HANDLING.steerBuild) * dt
  if (Math.abs(t - current) <= rate) return t
  return current + Math.sign(t - current) * rate
}

// Sideways speed full lock gives at this speed (half-widths/s).
export function steerAuthority(speed: number): number {
  const pct = speed / MAX_SPEED
  const ease = 1 - HANDLING.highSpeedEase * Math.max(0, Math.min(1, (pct - 0.55) / 0.75))
  return Math.min(HANDLING.steerRate * ease, (HANDLING.maxSlip * speed) / ROAD_WIDTH)
}

// How hard a bend pushes the car to its outside (half-widths/s, signed).
export function bendDrift(speed: number, curve: number): number {
  const pct = speed / MAX_SPEED
  const tight = 1 + HANDLING.tightGain * Math.max(0, Math.abs(curve) - HANDLING.tightFrom)
  return -HANDLING.drift * pct * pct * curve * tight
}

function stepPlayer(s: RaceState, p: Car, input: RaceInput, dt: number, ev: RaceEvent[]) {
  const seg = segmentAt(s.road, p.z)
  const gripUp = p.gripT > 0 || p.starT > 0
  const offBefore = Math.abs(p.x) > 1

  if (input.usePower && s.slots.length > 0) firePower(s, p, s.slots.shift() as PowerId, ev)

  // Steering -> lateral velocity (see HANDLING).
  p.steer = smoothSteer(p.steer, input.steer, dt)
  const authority = steerAuthority(p.speed) * (gripUp ? 1.15 : 1) * (p.crashT > 0 ? 0.6 : 1) * (offBefore ? 0.85 : 1)
  const drift = bendDrift(p.speed, seg.curve) * (p.gripT > 0 ? 0.5 : 1)
  const targetVx = p.steer * authority + drift
  const tau = offBefore && !shielded(p) ? HANDLING.tauGrass : HANDLING.tauRoad
  p.vx += (targetVx - p.vx) * approach(dt, tau)
  // Knocks shove the car sideways and fade; they never turn its nose.
  p.kick -= p.kick * approach(dt, 0.25)
  const xBefore = p.x
  p.x += (p.vx + p.kick) * dt

  // Guard rail on the outside of sharp bends: glance off it (a little
  // speed lost), never a dead stop -- it keeps the car on the circuit.
  const rail = seg.rail
  if (rail !== 0) {
    const inner = RAIL_OFFSET - CAR_HALF
    const outer = RAIL_OFFSET + CAR_HALF
    const was = xBefore * rail
    const now = p.x * rail
    const hitFromRoad = was <= inner + 1e-6 && now > inner
    const hitFromGrass = was >= outer - 1e-6 && now < outer
    if (hitFromRoad || hitFromGrass) {
      const into = Math.abs(p.vx + p.kick)
      const back = hitFromRoad ? -rail : rail
      p.x = rail * (hitFromRoad ? inner : outer)
      if (p.vx * back < 0) p.vx = 0
      p.kick = back * Math.min(1.1, 0.2 + into * 0.3)
      if (into > 0.35 && p.railT <= 0) {
        if (!shielded(p)) p.speed *= 1 - 0.1 * Math.min(1, into / 2)
        p.railT = 0.4
        ev.push({ type: 'rail' })
      }
    }
  }

  const cap = topSpeed(p)
  if (input.brake > 0) p.speed += BRAKING * input.brake * dt
  else if (input.throttle > 0 && p.crashT <= 0) p.speed += ACCEL * (boosting(p) ? 1.6 : 1) * input.throttle * dt
  else p.speed += DECEL * dt
  if (boosting(p) && p.speed < cap && input.brake <= 0) p.speed += ACCEL * 0.8 * dt

  const off = Math.abs(p.x) > 1
  if (off) {
    s.stats.offroadTime += dt
    s.lapOffroad += dt
    if (!s.wasOffroad) ev.push({ type: 'offroad' })
    if (p.speed > OFFROAD_LIMIT && !shielded(p)) p.speed += OFFROAD_DECEL * dt
    // Roadside scenery.
    for (const sp of seg.sprites) {
      if (!sp.solid) continue
      if (Math.abs(p.x - sp.offset) < CAR_HALF + sp.halfWidth * 0.6) {
        const toRoad = -Math.sign(sp.offset)
        if (shielded(p)) {
          p.speed *= 0.9
          ev.push({ type: 'shieldHit' })
        } else {
          p.speed = MAX_SPEED * 0.12
          p.crashT = 0.8
          s.stats.crashes++
          s.lapCrashed = true
          ev.push({ type: 'crash' })
        }
        p.x = sp.offset + toRoad * (sp.halfWidth * 0.6 + CAR_HALF + 0.08)
        // Glance off, back towards the road.
        p.vx = 0
        p.kick = toRoad * 0.6
        break
      }
    }
  }
  s.wasOffroad = off

  // Cars ahead: bump into them from behind.
  for (let i = 1; i < s.cars.length; i++) {
    const c = s.cars[i]
    const dz = c.z - p.z
    if (dz > 0 && dz < SEGMENT_LENGTH * 1.3 && p.speed > c.speed && Math.abs(c.x - p.x) < CAR_HALF * 2) {
      if (shielded(p)) {
        c.speed *= 0.82
        c.x += Math.sign(c.x - p.x || 1) * 0.3
        ev.push({ type: 'shieldHit' })
      } else {
        // Knocked aside a little, harder the faster the hit.
        const hit = Math.min(1, (p.speed - c.speed) / (MAX_SPEED * 0.4))
        const away = Math.sign(c.x - p.x || 1)
        p.speed = c.speed * 0.9
        p.kick -= away * (0.35 + 0.45 * hit)
        // The rival moves over, so nobody gets stuck nose-to-tail.
        c.aiYieldT = 1
        c.aiYieldX = Math.max(-0.78, Math.min(0.78, c.x + away * 0.6))
        s.stats.bumps++
        ev.push({ type: 'bump' })
      }
    }
  }

  p.speed = Math.max(0, Math.min(p.speed, cap))
  if (Math.abs(p.x) > X_LIMIT) {
    p.x = Math.sign(p.x) * X_LIMIT
    p.vx = 0
    p.kick = 0
  }
  s.stats.topSpeed = Math.max(s.stats.topSpeed, kmh(p.speed))

  // Heading relative to the road follows the direction of travel
  // (sideways speed against forward speed) within a few hundredths of a
  // second -- so a bump or a glance off the rail jolts the car, but never
  // snaps its nose (or the camera) round. Pointing across the road costs
  // a little forward progress.
  const travel = p.speed < 1 ? 0 : Math.max(-0.7, Math.min(0.7, Math.atan2(p.vx * ROAD_WIDTH, p.speed)))
  p.yaw += (travel - p.yaw) * approach(dt, 0.06)

  const lapZBefore = p.z % s.road.lapLength
  p.z += p.speed * Math.cos(p.yaw) * dt
  collectCoins(s, p, lapZBefore, ev)

  // Laps and the finish.
  const lap = Math.floor(p.z / s.road.lapLength)
  if (lap > p.lap) {
    const t = s.time - p.lapStart
    const best = p.bestLap === null || t < p.bestLap
    if (best) p.bestLap = t
    s.stats.lapTimes.push(t)
    if (s.lapOffroad < 1 && !s.lapCrashed) s.stats.cleanLaps++
    s.lapOffroad = 0
    s.lapCrashed = false
    p.lap = lap
    p.lapStart = s.time
    if (lap >= s.laps) {
      p.finished = true
      p.finishTime = s.time
      s.status = 'finished'
      ev.push({ type: 'finish', place: placeOf(s, 'player'), time: s.time })
    } else {
      ev.push({ type: 'lap', lap, time: t, best: best && lap > 1 })
      if (lap === s.laps - 1) ev.push({ type: 'finalLap' })
    }
  }
}

function collectCoins(s: RaceState, p: Car, lapZBefore: number, ev: RaceEvent[]) {
  const L = s.road.lapLength
  const lapZ = p.z % L
  const lap = Math.floor(p.z / L)
  const reach = p.magnetT > 0 ? 0.95 : 0.24
  const ahead = p.magnetT > 0 ? SEGMENT_LENGTH * 4 : 0
  for (let i = 0; i < s.coins.length; i++) {
    const key = lap * 10000 + i
    if (s.taken.has(key)) continue
    const c = s.coins[i]
    const passed = lapZ >= lapZBefore ? c.z >= lapZBefore && c.z <= lapZ + ahead : c.z >= lapZBefore || c.z <= lapZ + ahead
    if (passed && Math.abs(c.x - p.x) < reach) {
      s.taken.add(key)
      s.stats.coins++
      ev.push({ type: 'coin', total: s.stats.coins })
    }
  }
}

function firePower(s: RaceState, p: Car, id: PowerId, ev: RaceEvent[]) {
  s.stats.powersUsed++
  const d = POWERS[id].duration
  if (id === 'boost') p.boostT = d
  else if (id === 'shield') p.shieldT = d
  else if (id === 'burst') {
    p.burstT = 1.2
    p.speed = Math.max(p.speed, MAX_SPEED * BURST_MULT)
  } else if (id === 'magnet') p.magnetT = d
  else if (id === 'grip') p.gripT = d
  else if (id === 'repair') {
    p.x = Math.max(-0.6, Math.min(0.6, p.x))
    p.vx = 0
    p.kick = 0
    p.px = p.x
    p.crashT = 0
    p.speed = Math.max(p.speed, MAX_SPEED * 0.7)
  } else if (id === 'star') p.starT = d
  ev.push({ type: 'power', id })
}

function stepRival(s: RaceState, c: Car, dt: number, ev: RaceEvent[]) {
  const persona = PERSONA[c.personality ?? 'steady']
  const diff = DIFFICULTY[s.difficulty]
  const p = s.cars[0]
  const bend = curveAhead(s.road, c.z, 12)

  let target = MAX_SPEED * diff.pace * persona.top
  target *= 1 - Math.min(0.4, Math.abs(bend) * 0.05 * (1.2 - persona.corner))
  // Gentle catch-up so the race stays close either way (never cheating
  // the player of a hard-won lead).
  const gap = c.z - p.z
  if (!p.finished) {
    if (gap > SEGMENT_LENGTH * 25) target *= 0.97
    else if (gap < -SEGMENT_LENGTH * 12) target = Math.min(MAX_SPEED * 1.06, target * diff.catchUp)
  }
  // Mistakes: a lift, a wobble.
  if (c.aiMistakeT <= 0 && s.rand() < persona.mistake * diff.mistakesPerS * dt) c.aiMistakeT = 0.9
  if (c.aiMistakeT > 0) target *= 0.72
  // Aruvi saves speed for straights.
  if (persona.straightBoost && c.aiBoostCd <= 0 && straightAhead(s.road, c.z, 60) >= 45 && s.rand() < 0.4 * dt) {
    c.boostT = 2.2
    c.aiBoostCd = 14
    ev.push({ type: 'rivalBoost', id: c.id })
  }
  if (c.boostT > 0) target *= 1.18

  // Line: inside of the coming bend, or overtake whoever is ahead.
  let desired = persona.line * Math.sign(bend)
  for (const o of s.cars) {
    if (o === c || o.finished) continue
    const dz = o.z - c.z
    if (dz > 0 && dz < SEGMENT_LENGTH * (persona.weave > 0.5 ? 9 : 5) && Math.abs(o.x - c.x) < 0.45) {
      desired = o.x > 0 ? o.x - 0.62 : o.x + 0.62
      if (dz < SEGMENT_LENGTH * 2) target = Math.min(target, o.speed * (persona.weave > 0.5 ? 1.02 : 0.98))
    }
  }
  if (c.aiYieldT > 0) desired = c.aiYieldX
  c.aiTargetX = Math.max(-0.78, Math.min(0.78, desired))
  const x0 = c.x
  c.x += Math.sign(c.aiTargetX - c.x) * Math.min(Math.abs(c.aiTargetX - c.x), 1.1 * dt)
  // Mugil carries too much speed and drifts wide.
  const seg = segmentAt(s.road, c.z)
  c.x += bendDrift(c.speed, seg.curve) * 3 * persona.runsWide * dt

  if (c.speed < target) c.speed = Math.min(target, c.speed + ACCEL * 0.9 * dt)
  else c.speed = Math.max(target, c.speed - ACCEL * 2 * dt)
  if (Math.abs(c.x) > 1 && c.speed > OFFROAD_LIMIT) c.speed += OFFROAD_DECEL * 0.5 * dt

  // Don't drive through the player from behind.
  const dzp = p.z - c.z
  if (!p.finished && dzp > 0 && dzp < SEGMENT_LENGTH * 1.2 && c.speed > p.speed && Math.abs(p.x - c.x) < CAR_HALF * 2) {
    c.speed = p.speed * 0.95
    c.aiTargetX = p.x > 0 ? p.x - 0.7 : p.x + 0.7
  }

  c.x = Math.max(-1.4, Math.min(1.4, c.x))
  // Heading for drawing only (lane changes look like steering).
  const vx = dt > 0 ? (c.x - x0) / dt : 0
  c.vx = vx
  c.yaw += (Math.atan2(vx * ROAD_WIDTH, Math.max(c.speed, 1)) - c.yaw) * approach(dt, 0.12)
  c.z += c.speed * dt
  const lap = Math.floor(c.z / s.road.lapLength)
  if (lap > c.lap) {
    const t = s.time - c.lapStart
    if (c.bestLap === null || t < c.bestLap) c.bestLap = t
    c.lap = lap
    c.lapStart = s.time
    if (lap >= s.laps) {
      c.finished = true
      c.finishTime = s.time
    }
  }
}

// A checkpoint question was answered (the SERVER graded it). Correct ->
// a power-up in a slot (the oldest is replaced if both are full). Then a
// countdown resumes the race.
export function answerCheckpoint(s: RaceState, correct: boolean): { power: PowerId | null; replaced: PowerId | null } {
  s.stats.checkpointsAnswered++
  let power: PowerId | null = null
  let replaced: PowerId | null = null
  if (correct) {
    s.streak++
    s.stats.checkpointsCorrect++
    const lapTime = Math.max(1, s.time - s.cars[0].lapStart)
    power = awardPower({ place: s.place, racers: s.cars.length, offroadShare: s.lapOffroad / lapTime, streak: s.streak }, s.rand())
    if (s.slots.length >= POWER_SLOTS) replaced = s.slots.shift() ?? null
    s.slots.push(power)
  } else {
    s.streak = 0
  }
  resumeAfterQuestion(s)
  return { power, replaced }
}

// No question to ask (e.g. the session has none left): just carry on.
export function resumeAfterQuestion(s: RaceState) {
  if (s.status !== 'question') return
  s.status = 'resume'
  s.resumeT = RESUME_S
}

export function isFrozen(s: RaceState) {
  return s.status === 'question' || s.status === 'resume' || s.status === 'countdown'
}
