import { mulberry32 } from '../gameplay/rng'
import type { WordNinjaDifficulty } from './difficulty'

// Word Ninja's arcade layer: words fall down the dojo and the player
// slashes each one into the category lane it belongs to before it hits
// the floor. A word that lands unslashed costs a heart and falls again
// (every item still needs a lane before the round can be graded), the
// fall speeds up the more you slash, and a quick run of slashes builds a
// combo. The round's full item -> category mapping is still graded
// all-or-nothing by the server (/answer); only that verdict feeds back
// in via judgeRound(). Score, hearts and power-ups are in-match game
// state only -- XP and coins are computed server-side at /complete.
//
// The state object is mutated in place by the functions below (the
// same fixed-step pattern as Tower Defense and Grand Prix); the UI keeps
// it in a ref and snapshots it for rendering.

export const STEP_MS_NINJA = 1000 / 30
export const MAX_POWER_CHARGES = 3
// Consecutive slashes (with no miss) needed to earn a power charge.
export const COMBO_FOR_CHARGE = 6
// Consecutive clean rounds needed to win a heart back.
export const CLEAN_ROUNDS_FOR_HEART = 2
// Hearts lost when the server says a round had a word in the wrong lane.
export const WRONG_ROUND_HEARTS = 2
export const SLOW_DURATION_MS = 5000
export const SLOW_FACTOR = 0.4

export interface NinjaTuning {
  // Milliseconds for a word to fall the full height at speed x1.
  fallMs: number
  // Milliseconds between one word appearing and the next.
  spawnGapMs: number
  maxAirborne: number
  lives: number
  // Speed added per word slashed across the whole run (the escalation).
  speedPerSlash: number
  maxSpeed: number
}

export const NINJA_TUNING: Record<WordNinjaDifficulty, NinjaTuning> = {
  easy: { fallMs: 9000, spawnGapMs: 2300, maxAirborne: 2, lives: 6, speedPerSlash: 0.01, maxSpeed: 1.35 },
  normal: { fallMs: 6400, spawnGapMs: 1600, maxAirborne: 3, lives: 5, speedPerSlash: 0.02, maxSpeed: 1.8 },
  hard: { fallMs: 4400, spawnGapMs: 1050, maxAirborne: 4, lives: 4, speedPerSlash: 0.026, maxSpeed: 2.1 },
}

export type PowerId = 'slow' | 'shield'

export interface FallingWord {
  id: number
  item: string
  // 0 = top of the dojo, 1 = the floor.
  y: number
  // Horizontal position, 0..1 (purely visual).
  x: number
  golden: boolean
}

export type NinjaPhase = 'idle' | 'falling' | 'judging' | 'over'

export interface NinjaState {
  difficulty: WordNinjaDifficulty
  tuning: NinjaTuning
  rng: () => number
  phase: NinjaPhase
  timeMs: number
  // Rounds begun so far (1-based round number while one is running).
  round: number
  queue: string[]
  air: FallingWord[]
  placed: Record<string, string>
  itemsInRound: number
  goldenItem: string | null
  spawnTimerMs: number
  nextId: number
  lives: number
  maxLives: number
  combo: number
  score: number
  charges: Record<PowerId, number>
  slowMs: number
  shield: boolean
  cleanRun: number
  nextChargeKind: PowerId
  stats: {
    slashed: number
    missed: number
    shieldBlocks: number
    goldens: number
    bestCombo: number
    rounds: number
    cleanRounds: number
    powersUsed: number
  }
}

export type NinjaEvent =
  | { type: 'spawn'; id: number; golden: boolean }
  | { type: 'slash'; id: number; item: string; category: string; points: number; combo: number; golden: boolean }
  | { type: 'miss'; item: string; shielded: boolean; livesLeft: number }
  | { type: 'charge'; power: PowerId }
  | { type: 'power'; power: PowerId }
  | { type: 'roundReady' }
  | { type: 'judged'; correct: boolean; bonus: number; heart: boolean }
  | { type: 'over' }

export function createNinja({ seed, difficulty }: { seed: number; difficulty: WordNinjaDifficulty }): NinjaState {
  const tuning = NINJA_TUNING[difficulty]
  return {
    difficulty,
    tuning,
    rng: mulberry32(seed),
    phase: 'idle',
    timeMs: 0,
    round: 0,
    queue: [],
    air: [],
    placed: {},
    itemsInRound: 0,
    goldenItem: null,
    spawnTimerMs: 0,
    nextId: 1,
    lives: tuning.lives,
    maxLives: tuning.lives,
    combo: 0,
    score: 0,
    charges: { slow: 1, shield: 0 },
    slowMs: 0,
    shield: false,
    cleanRun: 0,
    nextChargeKind: 'shield',
    stats: { slashed: 0, missed: 0, shieldBlocks: 0, goldens: 0, bestCombo: 0, rounds: 0, cleanRounds: 0, powersUsed: 0 },
  }
}

export function speedOf(s: NinjaState): number {
  return Math.min(s.tuning.maxSpeed, 1 + s.tuning.speedPerSlash * s.stats.slashed)
}

// Starts a round with the current question's items. Items fall in a
// seeded shuffled order; with 3+ items one of them is a golden word.
export function beginRound(s: NinjaState, items: string[]): boolean {
  if (s.phase !== 'idle' || items.length === 0) return false
  const order = [...items]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(s.rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  s.queue = order
  s.air = []
  s.placed = {}
  s.itemsInRound = items.length
  s.goldenItem = items.length >= 3 ? order[1 + Math.floor(s.rng() * (order.length - 1))] : null
  // First word drops shortly after the round banner.
  s.spawnTimerMs = s.tuning.spawnGapMs - 900
  s.round += 1
  s.stats.rounds += 1
  s.phase = 'falling'
  return true
}

function grantCharge(s: NinjaState, events: NinjaEvent[]) {
  // Alternate the two powers, skipping one that is already full.
  let kind = s.nextChargeKind
  if (s.charges[kind] >= MAX_POWER_CHARGES) kind = kind === 'slow' ? 'shield' : 'slow'
  if (s.charges[kind] >= MAX_POWER_CHARGES) return
  s.charges[kind] += 1
  s.nextChargeKind = kind === 'slow' ? 'shield' : 'slow'
  events.push({ type: 'charge', power: kind })
}

export function stepNinja(s: NinjaState, dt: number = STEP_MS_NINJA): NinjaEvent[] {
  const events: NinjaEvent[] = []
  if (s.phase !== 'falling') return events
  s.timeMs += dt
  const slowed = s.slowMs > 0
  if (slowed) s.slowMs = Math.max(0, s.slowMs - dt)
  const timeScale = slowed ? SLOW_FACTOR : 1

  // Spawning.
  s.spawnTimerMs += dt * timeScale
  if (s.queue.length > 0 && s.air.length < s.tuning.maxAirborne && s.spawnTimerMs >= s.tuning.spawnGapMs) {
    s.spawnTimerMs = 0
    const item = s.queue.shift() as string
    const lane = s.air.length
    const x = 0.2 + ((s.rng() * 0.6 + lane * 0.33) % 0.6)
    const w: FallingWord = { id: s.nextId++, item, y: 0, x, golden: item === s.goldenItem }
    s.air.push(w)
    events.push({ type: 'spawn', id: w.id, golden: w.golden })
  } else if (s.air.length === 0 && s.queue.length > 0) {
    // Never leave the dojo empty for long.
    s.spawnTimerMs = Math.max(s.spawnTimerMs, s.tuning.spawnGapMs - 250)
  }

  // Falling.
  const dy = (dt * timeScale * speedOf(s)) / s.tuning.fallMs
  const landed: FallingWord[] = []
  for (const w of s.air) {
    w.y += dy
    if (w.y >= 1) landed.push(w)
  }
  for (const w of landed) {
    s.air = s.air.filter((a) => a.id !== w.id)
    s.combo = 0
    if (s.shield) {
      s.shield = false
      s.stats.shieldBlocks += 1
      // The shield throws the word back up to fall again.
      s.queue.unshift(w.item)
      events.push({ type: 'miss', item: w.item, shielded: true, livesLeft: s.lives })
      continue
    }
    s.lives = Math.max(0, s.lives - 1)
    s.stats.missed += 1
    // It still needs a lane: it drops again at the end of the round.
    s.queue.push(w.item)
    events.push({ type: 'miss', item: w.item, shielded: false, livesLeft: s.lives })
    if (s.lives === 0) {
      s.phase = 'over'
      events.push({ type: 'over' })
      return events
    }
  }

  if (s.queue.length === 0 && s.air.length === 0) {
    s.phase = 'judging'
    events.push({ type: 'roundReady' })
  }
  return events
}

// The word the lane keys/buttons act on: the one closest to the floor.
export function frontWord(s: NinjaState): FallingWord | null {
  let best: FallingWord | null = null
  for (const w of s.air) if (!best || w.y > best.y) best = w
  return best
}

// Slashes a word (the front word when no id is given) into a category.
// Earlier slashes (higher up the dojo) score more; the combo multiplies.
export function slash(s: NinjaState, category: string, wordId?: number | null): NinjaEvent[] {
  const events: NinjaEvent[] = []
  if (s.phase !== 'falling') return events
  const w = wordId != null ? s.air.find((a) => a.id === wordId) ?? null : frontWord(s)
  if (!w) return events
  s.air = s.air.filter((a) => a.id !== w.id)
  s.placed[w.item] = category
  s.combo += 1
  s.stats.slashed += 1
  s.stats.bestCombo = Math.max(s.stats.bestCombo, s.combo)
  const height = 1 - Math.min(1, w.y)
  const mult = 1 + Math.min(s.combo - 1, 20) * 0.1
  const points = Math.round((10 + 15 * height) * mult * (w.golden ? 3 : 1))
  s.score += points
  events.push({ type: 'slash', id: w.id, item: w.item, category, points, combo: s.combo, golden: w.golden })
  if (w.golden) {
    s.stats.goldens += 1
    grantCharge(s, events)
  }
  if (s.combo % COMBO_FOR_CHARGE === 0) grantCharge(s, events)
  if (s.queue.length === 0 && s.air.length === 0) {
    s.phase = 'judging'
    events.push({ type: 'roundReady' })
  }
  return events
}

export function canUsePower(s: NinjaState, power: PowerId): boolean {
  if (s.phase !== 'falling' || s.charges[power] <= 0) return false
  return power === 'slow' ? s.slowMs <= 0 : !s.shield
}

export function firePower(s: NinjaState, power: PowerId): NinjaEvent[] {
  if (!canUsePower(s, power)) return []
  s.charges[power] -= 1
  s.stats.powersUsed += 1
  if (power === 'slow') s.slowMs = SLOW_DURATION_MS
  else s.shield = true
  return [{ type: 'power', power }]
}

// The submission for the server: exactly CategorizeInput's shape.
export function roundSubmission(s: NinjaState): Record<string, string> {
  return { ...s.placed }
}

// Applies the server's verdict on the round. A clean round earns a score
// bonus and a power charge (and every CLEAN_ROUNDS_FOR_HEART in a row, a
// heart back); a round with any word in the wrong lane costs
// WRONG_ROUND_HEARTS hearts.
export function judgeRound(s: NinjaState, correct: boolean): NinjaEvent[] {
  const events: NinjaEvent[] = []
  if (s.phase !== 'judging') return events
  let bonus = 0
  let heart = false
  if (correct) {
    s.stats.cleanRounds += 1
    s.cleanRun += 1
    bonus = 40 * s.itemsInRound
    s.score += bonus
    grantCharge(s, events)
    if (s.cleanRun % CLEAN_ROUNDS_FOR_HEART === 0 && s.lives < s.maxLives) {
      s.lives += 1
      heart = true
    }
  } else {
    s.cleanRun = 0
    s.combo = 0
    s.lives = Math.max(0, s.lives - WRONG_ROUND_HEARTS)
  }
  events.push({ type: 'judged', correct, bonus, heart })
  s.air = []
  s.queue = []
  if (s.lives === 0) {
    s.phase = 'over'
    events.push({ type: 'over' })
  } else {
    s.phase = 'idle'
  }
  return events
}
