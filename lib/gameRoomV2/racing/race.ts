import type { RacingDifficulty, RacingDifficultySettings } from './difficulty'

// A single racer's state. Deliberately generic (an id + a label, not
// "the student") so the exact same simulation drives 1 racer today
// (solo vs. a scripted rival) and N racers later without a rewrite --
// this is the "groundwork for multiplayer" the spec asks for: the
// physics never assume there's exactly one racer, only the session
// layer above it does.
export interface RacerState {
  id: string
  label: string
  isPlayer: boolean
  distance: number
  // A currently-active speed effect from the racer's last answer, if
  // any -- null once it expires. Only one effect is active at a time;
  // a new answer's effect replaces rather than stacks with the old one,
  // so rapid-fire answering can't compound into an unbounded speed
  // (accuracy matters more than button speed, not "button speed also
  // helps if you spam fast enough").
  effect: { kind: 'boost' | 'penalty'; multiplier: number; remainingMs: number } | null
  finished: boolean
  finishedAtMs: number | null
}

export interface RaceState {
  difficulty: RacingDifficulty
  trackLength: number
  racers: RacerState[]
  elapsedMs: number
  raceOver: boolean
  winnerId: string | null
}

export const PLAYER_RACER_ID = 'player'
export const RIVAL_RACER_ID = 'rival'

export function createInitialRace(settings: RacingDifficultySettings, rivalLabel = 'Rival'): RaceState {
  return {
    difficulty: settings.id,
    trackLength: settings.trackLength,
    racers: [
      { id: PLAYER_RACER_ID, label: 'You', isPlayer: true, distance: 0, effect: null, finished: false, finishedAtMs: null },
      { id: RIVAL_RACER_ID, label: rivalLabel, isPlayer: false, distance: 0, effect: null, finished: false, finishedAtMs: null },
    ],
    elapsedMs: 0,
    raceOver: false,
    winnerId: null,
  }
}

// Applies a correct/incorrect answer's effect to one racer by id --
// works for any racer in the array, not just "the player", so a future
// multiplayer session can route each participant's own answer result
// through the exact same function.
export function applyAnswerEffect(state: RaceState, racerId: string, isCorrect: boolean, settings: RacingDifficultySettings): RaceState {
  return {
    ...state,
    racers: state.racers.map((r) =>
      r.id === racerId
        ? {
            ...r,
            effect: isCorrect
              ? { kind: 'boost', multiplier: settings.boostMultiplier, remainingMs: settings.boostDurationMs }
              : { kind: 'penalty', multiplier: settings.penaltyMultiplier, remainingMs: settings.penaltyDurationMs },
          }
        : r
    ),
  }
}

const DISTANCE_UNITS_PER_MS = 0.001

// The rival's own speed multiplier at a given elapsed time -- a smooth,
// fully deterministic wobble (not random, so the simulation stays
// reproducible for tests) that keeps a scripted solo opponent feeling
// alive without ever rubber-banding off the player's own distance. Its
// amplitude is deliberately small next to a real answer-driven boost
// (settings.boostMultiplier), so the student's own accuracy stays the
// dominant factor in who wins.
function rivalSpeedMultiplier(elapsedMs: number): number {
  return 1 + 0.15 * Math.sin(elapsedMs / 1400)
}

export interface RaceTickResult {
  state: RaceState
  justFinished: string[]
}

// The single simulation step -- pure function, same input always
// produces the same output. Advances every non-finished racer by its
// base speed times its current effect multiplier (1 if none), decays
// effect durations, and detects finishes/race-over.
export function tickRace(state: RaceState, deltaMs: number, settings: RacingDifficultySettings): RaceTickResult {
  if (state.raceOver) return { state, justFinished: [] }

  const justFinished: string[] = []

  const racers = state.racers.map((r) => {
    if (r.finished) return r

    const multiplier = r.effect ? r.effect.multiplier : r.isPlayer ? 1 : rivalSpeedMultiplier(state.elapsedMs)
    const distance = Math.min(state.trackLength, r.distance + settings.baseSpeed * multiplier * DISTANCE_UNITS_PER_MS * deltaMs)

    let effect = r.effect
    if (effect) {
      const remainingMs = effect.remainingMs - deltaMs
      effect = remainingMs > 0 ? { ...effect, remainingMs } : null
    }

    const finished = distance >= state.trackLength
    if (finished && !r.finished) justFinished.push(r.id)

    return { ...r, distance, effect, finished, finishedAtMs: finished ? state.elapsedMs + deltaMs : r.finishedAtMs }
  })

  const raceOver = racers.every((r) => r.finished)
  const winnerId = raceOver
    ? racers.reduce((best: RacerState, r) => ((r.finishedAtMs ?? Infinity) < (best.finishedAtMs ?? Infinity) ? r : best)).id
    : null

  return {
    state: { ...state, racers, elapsedMs: state.elapsedMs + deltaMs, raceOver, winnerId },
    justFinished,
  }
}
