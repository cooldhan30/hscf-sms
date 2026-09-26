import { mulberry32 } from '../gameplay/rng'
import type { RacingDifficulty } from './difficulty'

// Solo "Tamil Grand Prix": a 3-lap race against three AI rivals.
//
// Questions are checkpoint challenges spread along the race. A correct
// answer charges the BOOST meter (faster answers and combos charge more);
// the player chooses when to fire the boost. A wrong answer drains some
// boost and costs a brief slowdown -- never a permanent setback, and a
// slipstream helps a trailing player catch up.
//
// In-race values (meter, speed, placement) are a local game layer derived
// from the server's grading of each answer; persistent rewards (score, XP)
// are computed server-side at /complete.
//
// Live Classroom racing is separate (race.ts / liveRace.ts): there every
// racer's position is replayed on the server from graded answers.

export const LAPS = 3
export const LAP_LENGTH = 100
export const RACE_LENGTH = LAPS * LAP_LENGTH
export const BOOST_COST_MIN = 25
export const BOOST_MULTIPLIER = 1.75
export const BOOST_DRAIN_PER_SEC = 32
export const WRONG_METER_LOSS = 30
export const WRONG_SLOW_MULTIPLIER = 0.8
export const WRONG_SLOW_MS = 1500
export const SLIPSTREAM_GAP = 6
export const SLIPSTREAM_BONUS = 0.07
export const COUNTDOWN_MS = 3000
export const STEP_MS_GP = 1000 / 30

export type RivalStyle = 'steady' | 'sprinter' | 'surger'

export interface GpRacer {
  id: string
  name: string
  color: string
  isPlayer: boolean
  style: RivalStyle | null
  skill: number // rival pace relative to the player's base speed
  dist: number
  prevDist: number
  boostUntil: number
  slowUntil: number
  finishedAt: number | null
  lane: number
}

export type GpEvent =
  | { type: 'countdown'; n: number }
  | { type: 'go' }
  | { type: 'checkpoint'; index: number }
  | { type: 'lap'; lap: number }
  | { type: 'overtake'; name: string }
  | { type: 'overtaken'; name: string }
  | { type: 'boostStart' }
  | { type: 'boostEnd' }
  | { type: 'charge'; amount: number }
  | { type: 'wrong' }
  | { type: 'finish'; racerId: string; place: number }
  | { type: 'raceOver' }

export interface GpState {
  difficulty: RacingDifficulty
  baseSpeed: number
  timeMs: number
  racers: GpRacer[]
  meter: number
  boosting: boolean
  streak: number
  checkpoints: number[]
  checkpointsPassed: number
  lastLap: number
  lastPlace: number
  finishOrder: string[]
  raceOver: boolean
  rand: () => number
  stats: { boostsUsed: number; bestStreak: number; overtakes: number; correct: number; wrong: number }
}

const RIVALS: { name: string; color: string; style: RivalStyle }[] = [
  { name: 'Kayal', color: '#0ea5e9', style: 'steady' },
  { name: 'Mugil', color: '#f97316', style: 'sprinter' },
  { name: 'Aruvi', color: '#a855f7', style: 'surger' },
]

const RIVAL_SKILL: Record<RacingDifficulty, [number, number, number]> = {
  easy: [0.86, 0.9, 0.88],
  normal: [0.97, 1.0, 0.99],
  hard: [1.02, 1.05, 1.04],
}

// Seconds of pure driving the race should take for a question set of this
// size, leaving room to read and answer each checkpoint challenge.
export function planRaceSeconds(totalQuestions: number): number {
  return Math.max(60, totalQuestions * 8 + 25)
}

export function createGp(opts: { seed: number; difficulty: RacingDifficulty; totalQuestions: number }): GpState {
  const rand = mulberry32(opts.seed)
  const baseSpeed = RACE_LENGTH / planRaceSeconds(opts.totalQuestions)
  const skills = RIVAL_SKILL[opts.difficulty]
  const order = [0, 1, 2].sort(() => rand() - 0.5)
  const racers: GpRacer[] = [
    { id: 'player', name: 'You', color: '#facc15', isPlayer: true, style: null, skill: 1, dist: 0, prevDist: 0, boostUntil: 0, slowUntil: 0, finishedAt: null, lane: 0 },
    ...order.map((i, n) => ({
      id: `rival-${i}`,
      name: RIVALS[i].name,
      color: RIVALS[i].color,
      isPlayer: false,
      style: RIVALS[i].style,
      skill: skills[i],
      dist: 0,
      prevDist: 0,
      boostUntil: 0,
      slowUntil: 0,
      finishedAt: null,
      lane: n + 1,
    })),
  ]
  // Checkpoints evenly spread over the first 90% of the race.
  const n = opts.totalQuestions
  const checkpoints = Array.from({ length: n }, (_, i) => ((i + 1) / (n + 1)) * RACE_LENGTH * 0.9)
  return {
    difficulty: opts.difficulty,
    baseSpeed,
    timeMs: -COUNTDOWN_MS,
    racers,
    meter: 20,
    boosting: false,
    streak: 0,
    checkpoints,
    checkpointsPassed: 0,
    lastLap: 1,
    lastPlace: 1,
    finishOrder: [],
    raceOver: false,
    rand,
    stats: { boostsUsed: 0, bestStreak: 0, overtakes: 0, correct: 0, wrong: 0 },
  }
}

export function player(state: GpState): GpRacer {
  return state.racers[0]
}

export function standings(state: GpState): GpRacer[] {
  return [...state.racers].sort((a, b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt
    if (a.finishedAt !== null) return -1
    if (b.finishedAt !== null) return 1
    return b.dist - a.dist
  })
}

export function placeOf(state: GpState, id: string): number {
  return standings(state).findIndex((r) => r.id === id) + 1
}

export function lapOf(dist: number): number {
  return Math.min(LAPS, Math.floor(dist / LAP_LENGTH) + 1)
}

// --- Player inputs --------------------------------------------------------

export function answerChallenge(state: GpState, result: { correct: boolean; points: number }, events: GpEvent[] = []): number {
  if (result.correct) {
    state.streak++
    state.stats.correct++
    state.stats.bestStreak = Math.max(state.stats.bestStreak, state.streak)
    const speedBonus = Math.max(0, Math.min(15, Math.round((result.points - 1000) / 33)))
    const comboBonus = Math.min(20, (state.streak - 1) * 5)
    const amount = 30 + speedBonus + comboBonus
    const before = state.meter
    state.meter = Math.min(100, state.meter + amount)
    events.push({ type: 'charge', amount: Math.round(state.meter - before) })
    return state.meter - before
  }
  state.streak = 0
  state.stats.wrong++
  state.meter = Math.max(0, state.meter - WRONG_METER_LOSS)
  if (state.boosting) {
    state.boosting = false
    events.push({ type: 'boostEnd' })
  }
  player(state).slowUntil = Math.max(state.timeMs, 0) + WRONG_SLOW_MS
  events.push({ type: 'wrong' })
  return 0
}

export function canBoost(state: GpState): boolean {
  return !state.boosting && state.meter >= BOOST_COST_MIN && state.timeMs >= 0 && player(state).finishedAt === null
}

export function activateBoost(state: GpState, events: GpEvent[] = []): boolean {
  if (!canBoost(state)) return false
  state.boosting = true
  state.stats.boostsUsed++
  events.push({ type: 'boostStart' })
  return true
}

// --- Simulation ----------------------------------------------------------

function rivalPace(state: GpState, r: GpRacer, playerDist: number): number {
  const progress = r.dist / RACE_LENGTH
  let pace = r.skill
  if (r.style === 'sprinter') pace *= progress < 0.4 ? 1.08 : 0.95
  if (r.style === 'surger') pace *= progress < 0.55 ? 0.94 : 1.08
  if (r.style === 'steady') pace *= 1 + 0.03 * Math.sin(state.timeMs / 2300 + r.lane)
  // Rubber band keeps the pack together without deciding the race.
  if (playerDist - r.dist > RACE_LENGTH * 0.08) pace *= 1.06
  if (r.dist - playerDist > RACE_LENGTH * 0.1) pace *= 0.96
  return pace
}

export function stepGp(state: GpState, dtMs: number = STEP_MS_GP): GpEvent[] {
  const events: GpEvent[] = []
  if (state.raceOver) return events
  const before = state.timeMs
  state.timeMs += dtMs
  if (state.timeMs < 0) {
    const n = Math.ceil(-state.timeMs / 1000)
    if (before <= -COUNTDOWN_MS || Math.ceil(-before / 1000) !== n) events.push({ type: 'countdown', n })
    return events
  }
  if (before < 0) events.push({ type: 'go' })

  const me = player(state)
  const placeBefore = placeOf(state, me.id)
  const leader = Math.max(...state.racers.map((r) => r.dist))
  const secs = dtMs / 1000

  for (const r of state.racers) {
    r.prevDist = r.dist
    if (r.finishedAt !== null) continue
    let mult = 1
    if (r.isPlayer) {
      if (state.boosting) {
        mult *= BOOST_MULTIPLIER
        state.meter = Math.max(0, state.meter - BOOST_DRAIN_PER_SEC * secs)
        if (state.meter <= 0) {
          state.boosting = false
          events.push({ type: 'boostEnd' })
        }
      }
      if (r.slowUntil > state.timeMs) mult *= WRONG_SLOW_MULTIPLIER
      if (leader - r.dist > SLIPSTREAM_GAP) mult *= 1 + SLIPSTREAM_BONUS
    } else {
      mult *= rivalPace(state, r, me.dist)
      // Rivals occasionally "answer" and boost, like a real opponent would.
      if (r.boostUntil <= state.timeMs && state.rand() < 0.12 * secs) r.boostUntil = state.timeMs + 2200
      if (r.boostUntil > state.timeMs) mult *= 1.45
    }
    r.dist = Math.min(RACE_LENGTH, r.dist + state.baseSpeed * mult * secs)
    if (r.dist >= RACE_LENGTH && r.finishedAt === null) {
      r.finishedAt = state.timeMs
      state.finishOrder.push(r.id)
      events.push({ type: 'finish', racerId: r.id, place: state.finishOrder.length })
      if (r.isPlayer && state.boosting) state.boosting = false
    }
  }

  // Checkpoints and laps for the player.
  while (state.checkpointsPassed < state.checkpoints.length && me.dist >= state.checkpoints[state.checkpointsPassed]) {
    events.push({ type: 'checkpoint', index: state.checkpointsPassed })
    state.checkpointsPassed++
  }
  const lap = lapOf(me.dist)
  if (lap > state.lastLap && me.finishedAt === null) {
    state.lastLap = lap
    events.push({ type: 'lap', lap })
  }

  // Overtakes.
  const placeAfter = placeOf(state, me.id)
  if (placeAfter < placeBefore) {
    const passed = standings(state)[placeAfter]
    state.stats.overtakes++
    events.push({ type: 'overtake', name: passed?.name ?? '' })
  } else if (placeAfter > placeBefore) {
    const by = standings(state)[placeAfter - 2]
    events.push({ type: 'overtaken', name: by?.name ?? '' })
  }
  state.lastPlace = placeAfter

  if (state.racers.every((r) => r.finishedAt !== null)) {
    state.raceOver = true
    events.push({ type: 'raceOver' })
  }
  return events
}
