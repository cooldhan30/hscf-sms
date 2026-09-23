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

// One racer's actual distance/effect state, replayed from a
// server-held answer history -- the authoritative mechanism behind
// multiplayer racing's "prevent race progress manipulation" and
// "server-authoritative score/progress" requirements. Never trusts a
// client-reported position: instead, this reconstructs EXACTLY what
// tickRace would have produced had it run continuously from race start
// to now, driven only by (isCorrect, timestamp) pairs pulled from
// sms_gamev2_answers -- the same server-persisted, already-tamper-proof
// record every engine's scoring already relies on (see answer/route.ts's
// own "nothing the client claims is ever trusted" precedent). A client
// is never asked to report its own distance at all, so there is no
// value to spoof in the first place -- this is stronger than validating
// a client-submitted position, which is why this function exists rather
// than a "verify the client's claimed distance" check.
//
// isPlayer only affects the ONE cosmetic branch tickRace itself already
// has (a non-boosted human racer moves at flat 1x, a non-boosted NPC
// rival wobbles per rivalSpeedMultiplier) -- every real participant in
// a multiplayer race is isPlayer: true, so that branch is inert for
// them; it only still matters for solo play's own scripted rival.
export interface AnswerEvent {
  isCorrect: boolean
  atMs: number
}

export function replayRacerFromAnswers(
  raceStartMs: number,
  nowMs: number,
  answers: AnswerEvent[],
  settings: RacingDifficultySettings
): { distance: number; finished: boolean; finishedAtMs: number | null; effect: RacerState['effect'] } {
  let distance = 0
  let effect: RacerState['effect'] = null
  let cursorMs = raceStartMs
  let finished = false
  let finishedAtMs: number | null = null

  // Advances the simulation from cursorMs to targetMs, but NEVER in one
  // single jump when an effect is active and would expire partway
  // through that span -- an effect's speed multiplier only applies for
  // its own remainingMs, then movement continues at the post-expiry
  // rate for whatever span is left. Recursing in effect-duration-bounded
  // chunks is what makes this match tickRace's own per-tick decay
  // exactly, rather than (incorrectly) applying one effect's multiplier
  // across a jump that spans well past when it actually wore off.
  function advanceTo(targetMs: number) {
    if (finished || targetMs <= cursorMs) return

    const effectExpiresAtMs = effect ? cursorMs + effect.remainingMs : Infinity
    const chunkEndMs = Math.min(targetMs, effectExpiresAtMs)
    const deltaMs = chunkEndMs - cursorMs
    const multiplier = effect ? effect.multiplier : 1
    distance = Math.min(settings.trackLength, distance + settings.baseSpeed * multiplier * DISTANCE_UNITS_PER_MS * deltaMs)

    if (effect) {
      const remainingMs = effect.remainingMs - deltaMs
      effect = remainingMs > 0 ? { ...effect, remainingMs } : null
    }

    if (distance >= settings.trackLength && !finished) {
      finished = true
      finishedAtMs = chunkEndMs
    }

    cursorMs = chunkEndMs

    // The effect expired before reaching targetMs -- recurse to cover
    // the remaining span at the (now-cleared) post-expiry rate.
    if (!finished && cursorMs < targetMs) advanceTo(targetMs)
  }

  // Answers are assumed already ordered by timestamp (the caller reads
  // them from sms_gamev2_answers ordered by answered_at, or equivalently
  // by question_index, which is monotonic per session by construction).
  for (const answer of answers) {
    advanceTo(Math.min(answer.atMs, nowMs))
    if (finished) break
    effect = answer.isCorrect
      ? { kind: 'boost', multiplier: settings.boostMultiplier, remainingMs: settings.boostDurationMs }
      : { kind: 'penalty', multiplier: settings.penaltyMultiplier, remainingMs: settings.penaltyDurationMs }
  }

  advanceTo(nowMs)

  return { distance, finished, finishedAtMs, effect }
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
