import { createFlyingWords, assignWordToLane, buildCategorizeSubmission, type FlyingWord } from './lanes'
import type { WordNinjaDifficultySettings } from './difficulty'

export interface ActiveWord extends FlyingWord {
  spawnedAtMs: number
  // Once a word's flight time has fully elapsed without being slashed,
  // it's "missed" -- still requires a lane assignment before
  // submission (the round doesn't lock a missed word to any category),
  // but the visual should show it needs a second look.
  missed: boolean
}

export interface RoundState {
  queue: FlyingWord[]
  active: ActiveWord[]
  resolved: FlyingWord[]
  elapsedMs: number
  spawnTimerMs: number
  allResolved: boolean
}

export function createInitialRound(items: string[]): RoundState {
  return {
    queue: createFlyingWords(items),
    active: [],
    resolved: [],
    elapsedMs: 0,
    spawnTimerMs: 0,
    allResolved: false,
  }
}

// Advances the round's flight schedule by deltaMs: spawns new words
// from the queue up to maxConcurrentWords, marks any word whose flight
// time has fully elapsed as "missed" (still requires a lane assignment,
// just visually flagged), and detects whether every word across
// queue+active+resolved has been assigned a lane.
export function tickRound(state: RoundState, deltaMs: number, settings: WordNinjaDifficultySettings): RoundState {
  const elapsedMs = state.elapsedMs + deltaMs
  let spawnTimerMs = state.spawnTimerMs + deltaMs
  let queue = state.queue
  const newlyActive: ActiveWord[] = []

  while (queue.length > 0 && state.active.length + newlyActive.length < settings.maxConcurrentWords && spawnTimerMs >= settings.spawnIntervalMs) {
    spawnTimerMs -= settings.spawnIntervalMs
    const [next, ...rest] = queue
    queue = rest
    newlyActive.push({ ...next, spawnedAtMs: elapsedMs, missed: false })
  }

  const active = [...state.active, ...newlyActive].map((w) => ({
    ...w,
    missed: w.assignedCategory === undefined && elapsedMs - w.spawnedAtMs >= settings.flightDurationMs,
  }))

  // Every word is accounted for once the queue is drained and nothing
  // is still in flight -- active words are always unassigned by
  // construction (slashWord is what moves a word out of `active` into
  // `resolved`), so "active is empty" is the real completion signal.
  const totalWords = queue.length + active.length + state.resolved.length
  const allResolved = totalWords > 0 && queue.length === 0 && active.length === 0

  return { ...state, queue, active, elapsedMs, spawnTimerMs, allResolved }
}

// Slashing a word into a lane resolves it -- removed from `active` and
// appended to `resolved` with its lane assignment recorded. Does
// nothing if the word isn't currently active (already resolved, or a
// stale id from a previous round), so a caller never needs to
// pre-validate.
export function slashWord(state: RoundState, wordId: string, category: string): RoundState {
  const word = state.active.find((w) => w.id === wordId)
  if (!word) return state

  const resolvedWord = assignWordToLane([word], wordId, category)[0]
  return {
    ...state,
    active: state.active.filter((w) => w.id !== wordId),
    resolved: [...state.resolved, resolvedWord],
  }
}

export function isRoundReadyToSubmit(state: RoundState): boolean {
  return state.allResolved
}

export function buildRoundSubmission(state: RoundState): Record<string, string> {
  return buildCategorizeSubmission(state.resolved)
}
