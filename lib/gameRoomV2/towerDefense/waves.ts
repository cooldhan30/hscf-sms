import type { DifficultySettings } from './difficulty'

// Enemy archetypes. Speed is in cells per second; armour is subtracted
// from every hit (minimum 1 damage) unless the attack pierces armour.
export type EnemyKind = 'grunt' | 'scout' | 'swarm' | 'brute' | 'armored' | 'boss'

export interface EnemyDefinition {
  kind: EnemyKind
  name: string
  hp: number
  speed: number
  armor: number
  reward: number
  baseDamage: number
  radius: number // in cells, for rendering and splash checks
  color: string
  // Budget cost when composing a wave.
  cost: number
}

export const ENEMY_DEFINITIONS: Record<EnemyKind, EnemyDefinition> = {
  grunt: { kind: 'grunt', name: 'Shadow', hp: 88, speed: 1.0, armor: 0, reward: 3, baseDamage: 1, radius: 0.22, color: '#57534e', cost: 10 },
  scout: { kind: 'scout', name: 'Scout', hp: 48, speed: 1.9, armor: 0, reward: 2, baseDamage: 1, radius: 0.18, color: '#ca8a04', cost: 9 },
  swarm: { kind: 'swarm', name: 'Swarmling', hp: 26, speed: 1.4, armor: 0, reward: 1, baseDamage: 1, radius: 0.13, color: '#65a30d', cost: 4 },
  brute: { kind: 'brute', name: 'Brute', hp: 330, speed: 0.6, armor: 2, reward: 8, baseDamage: 3, radius: 0.32, color: '#7f1d1d', cost: 32 },
  armored: { kind: 'armored', name: 'Ironhide', hp: 165, speed: 0.9, armor: 6, reward: 6, baseDamage: 2, radius: 0.25, color: '#475569', cost: 24 },
  boss: { kind: 'boss', name: 'Irul King', hp: 3300, speed: 0.42, armor: 4, reward: 80, baseDamage: 10, radius: 0.45, color: '#4c1d95', cost: 0 },
}

export const BOSS_SUMMON_INTERVAL_MS = 6000
export const BOSS_ENRAGE_AT = 0.5
export const BOSS_ENRAGE_SPEED_MULTIPLIER = 1.6

export interface SpawnEntry {
  kind: EnemyKind
  delayMs: number // after the previous spawn
  bossScale?: number // mini-boss uses a fraction of full boss HP
}

export function waveHealthScale(wave: number): number {
  return 1 + (wave - 1) * 0.24
}

// Which kinds a wave may contain.
function unlockedKinds(wave: number): EnemyKind[] {
  const kinds: EnemyKind[] = ['grunt', 'scout']
  if (wave >= 2) kinds.push('swarm')
  if (wave >= 3) kinds.push('brute')
  if (wave >= 4) kinds.push('armored')
  return kinds
}

export function isBossWave(wave: number, totalWaves: number): boolean {
  return wave === totalWaves
}

export function isMiniBossWave(wave: number, totalWaves: number): boolean {
  return totalWaves >= 8 && wave === Math.ceil(totalWaves / 2)
}

// Budget-based composition: each wave has a point budget that grows with
// the wave number; enemies are "bought" from the unlocked pool with the
// run's RNG, so runs differ but stay fair and escalate predictably.
export function composeWave(wave: number, totalWaves: number, settings: DifficultySettings, rand: () => number): SpawnEntry[] {
  let budget = Math.round((45 + 30 * Math.pow(wave, 1.45)) * settings.waveBudgetMultiplier)
  const entries: SpawnEntry[] = []
  const pool = unlockedKinds(wave)

  if (isBossWave(wave, totalWaves)) {
    budget = Math.round(budget * 0.55) // escorts; the boss is the main event
  }
  if (isMiniBossWave(wave, totalWaves)) {
    budget = Math.round(budget * 0.7)
  }

  let guard = 0
  while (budget > 0 && guard++ < 200) {
    const affordable = pool.filter((k) => ENEMY_DEFINITIONS[k].cost <= budget)
    if (affordable.length === 0) break
    // Weight newer/tougher kinds a little higher in later waves.
    const kind = affordable[Math.floor(rand() * affordable.length)]
    if (kind === 'swarm') {
      const group = 4 + Math.floor(rand() * 3)
      for (let i = 0; i < group && budget >= ENEMY_DEFINITIONS.swarm.cost; i++) {
        entries.push({ kind: 'swarm', delayMs: i === 0 ? 900 : 260 })
        budget -= ENEMY_DEFINITIONS.swarm.cost
      }
    } else {
      entries.push({ kind, delayMs: kind === 'brute' ? 1300 : kind === 'scout' ? 650 : 850 })
      budget -= ENEMY_DEFINITIONS[kind].cost
    }
  }

  if (isMiniBossWave(wave, totalWaves)) entries.push({ kind: 'boss', delayMs: 2000, bossScale: 0.45 })
  if (isBossWave(wave, totalWaves)) entries.push({ kind: 'boss', delayMs: 2500, bossScale: 1 })
  if (entries.length > 0) entries[0] = { ...entries[0], delayMs: 600 }
  return entries
}

// For the pre-wave preview ("Incoming: 6 Shadows, 1 Brute...").
export function summarizeWave(entries: SpawnEntry[]): { kind: EnemyKind; count: number }[] {
  const counts = new Map<EnemyKind, number>()
  entries.forEach((e) => counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1))
  return Array.from(counts.entries()).map(([kind, count]) => ({ kind, count }))
}

// How many waves a run has, and how many questions come before each wave,
// derived from the question set size so the battle and the learning end
// together: every question is answered before the final (boss) wave.
export function planRun(totalQuestions: number): { totalWaves: number; questionsBeforeWave: number[] } {
  const totalWaves = Math.max(4, Math.min(10, Math.ceil(totalQuestions / 2)))
  const base = Math.floor(totalQuestions / totalWaves)
  const extra = totalQuestions % totalWaves
  const questionsBeforeWave = Array.from({ length: totalWaves }, (_, i) => base + (i < extra ? 1 : 0))
  return { totalWaves, questionsBeforeWave }
}
