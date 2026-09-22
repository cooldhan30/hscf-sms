import { MISSION_LENGTH, nextUnreachedPlanet, reachedPlanetIds } from './route'
import type { SpaceMissionDifficultySettings } from './difficulty'

// A correct-answer streak boosts thrust the same way every V2 engine's
// combo mechanic rewards consecutive success -- capped, not
// unbounded, so a long streak stays a strong-but-finite bonus rather
// than letting one lucky run trivialize the rest of the mission.
export const STREAK_THRUST_BONUS_PER_STEP = 0.08
export const STREAK_THRUST_BONUS_CAP = 0.5 // +50% thrust at streak 7+ (0.08 * 7 rounds up to the cap)

// A wrong answer never strands the mission or forces a restart -- it
// costs shields and opens a short, skippable "recovery" beat (a brief
// drift/repair moment the ship visibly recovers from), matching the
// "never humiliating or overly punitive" requirement. Shields
// bottoming out at 0 does NOT end the mission either -- it just means
// the next wrong answer's damage has nothing left to absorb, so the
// ship visibly flickers but the player keeps flying and answering.
export interface FlightState {
  difficulty: SpaceMissionDifficultySettings['id']
  distanceTravelled: number
  shields: number
  maxShields: number
  currentStreak: number
  bestStreak: number
  correctAnswerCount: number
  wrongAnswerCount: number
  recovering: boolean
  arrivedPlanetIds: string[]
  missionComplete: boolean
}

export function createInitialFlight(settings: SpaceMissionDifficultySettings): FlightState {
  return {
    difficulty: settings.id,
    distanceTravelled: 0,
    shields: settings.startingShields,
    maxShields: settings.maxShields,
    currentStreak: 0,
    bestStreak: 0,
    correctAnswerCount: 0,
    wrongAnswerCount: 0,
    recovering: false,
    arrivedPlanetIds: reachedPlanetIds(0),
    missionComplete: false,
  }
}

// The thrust multiplier a streak currently grants -- pure function of
// streak length, deterministic and testable, mirroring Treasure
// Quest's keysEarnedForAnswer determinism precedent.
export function streakThrustMultiplier(currentStreak: number): number {
  return 1 + Math.min(STREAK_THRUST_BONUS_CAP, currentStreak * STREAK_THRUST_BONUS_PER_STEP)
}

export function applyCorrectAnswer(state: FlightState, settings: SpaceMissionDifficultySettings): FlightState {
  const nextStreak = state.currentStreak + 1
  const thrust = Math.round(settings.thrustPerCorrectAnswer * streakThrustMultiplier(state.currentStreak))
  const nextDistance = Math.min(MISSION_LENGTH, state.distanceTravelled + thrust)
  // A correct answer also tops the shields up a little -- "recharge
  // shields/fuel" per the spec -- capped at max, never overcharging.
  const nextShields = Math.min(state.maxShields, state.shields + Math.round(thrust / 4))

  return {
    ...state,
    distanceTravelled: nextDistance,
    shields: nextShields,
    currentStreak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    correctAnswerCount: state.correctAnswerCount + 1,
    recovering: false,
    arrivedPlanetIds: reachedPlanetIds(nextDistance),
    missionComplete: nextDistance >= MISSION_LENGTH,
  }
}

export function applyWrongAnswer(state: FlightState, settings: SpaceMissionDifficultySettings): FlightState {
  return {
    ...state,
    shields: Math.max(0, state.shields - settings.shieldDamagePerWrongAnswer),
    currentStreak: 0,
    wrongAnswerCount: state.wrongAnswerCount + 1,
    // Opens the short recovery beat -- resolved by resolveRecovery(),
    // never by losing the mission or being sent backward.
    recovering: true,
  }
}

// Ends the recovery beat once its brief UI moment has played out --
// the ship is back under control, no distance or shields lost beyond
// the wrong answer's own cost.
export function resolveRecovery(state: FlightState): FlightState {
  if (!state.recovering) return state
  return { ...state, recovering: false }
}

export function missionProgressPct(state: FlightState): number {
  return Math.min(100, Math.round((state.distanceTravelled / MISSION_LENGTH) * 100))
}

export function nextCheckpoint(state: FlightState) {
  return nextUnreachedPlanet(state.distanceTravelled)
}
