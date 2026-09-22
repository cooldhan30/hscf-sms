import type { DifficultySettings } from './difficulty'

// The path enemies walk is a fixed sequence of waypoints in an abstract
// 0..10 x 0..6 grid (rendering maps this to real pixels/percent). Every
// wave/session uses the same path -- only enemy count/health/speed
// change with difficulty and wave number.
export const PATH_WAYPOINTS: { x: number; y: number }[] = [
  { x: 0, y: 1 },
  { x: 2, y: 1 },
  { x: 2, y: 4 },
  { x: 5, y: 4 },
  { x: 5, y: 1 },
  { x: 8, y: 1 },
  { x: 8, y: 5 },
  { x: 10, y: 5 },
]

export function pathLength(): number {
  let total = 0
  for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
    total += segmentLength(PATH_WAYPOINTS[i - 1], PATH_WAYPOINTS[i])
  }
  return total
}

function segmentLength(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

// Resolves a distance-travelled-along-the-path value into an actual
// {x,y} position -- used every simulation tick for every enemy, and by
// the renderer to place enemy sprites.
export function positionAtDistance(distance: number): { x: number; y: number } {
  if (distance <= 0) return { ...PATH_WAYPOINTS[0] }
  let remaining = distance
  for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
    const a = PATH_WAYPOINTS[i - 1]
    const b = PATH_WAYPOINTS[i]
    const segLen = segmentLength(a, b)
    if (remaining <= segLen) {
      const t = segLen === 0 ? 0 : remaining / segLen
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    remaining -= segLen
  }
  return { ...PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1] }
}

export interface EnemyDefinition {
  kind: 'runner' | 'brute' | 'shade'
  baseHealth: number
  baseSpeed: number
  reward: number
}

// Three enemy kinds give waves visible variety without inventing a huge
// bestiary: a fast-but-fragile runner, a slow-but-tough brute, and a
// mid-stat shade introduced in later waves.
export const ENEMY_DEFINITIONS: Record<EnemyDefinition['kind'], EnemyDefinition> = {
  runner: { kind: 'runner', baseHealth: 18, baseSpeed: 1.4, reward: 1 },
  brute: { kind: 'brute', baseHealth: 55, baseSpeed: 0.7, reward: 2 },
  shade: { kind: 'shade', baseHealth: 32, baseSpeed: 1.05, reward: 2 },
}

// Deterministic wave composition -- every wave is fully described by
// its number, so "restart this wave on refresh" (client-only board
// state) never needs to persist which enemies were queued.
export function waveComposition(waveNumber: number, settings: DifficultySettings): EnemyDefinition['kind'][] {
  const count = settings.enemiesPerWave + Math.floor((waveNumber - 1) * 1.5)
  const kinds: EnemyDefinition['kind'][] = []
  for (let i = 0; i < count; i++) {
    if (waveNumber >= 3 && i % 5 === 4) kinds.push('shade')
    else if (waveNumber >= 2 && i % 4 === 3) kinds.push('brute')
    else kinds.push('runner')
  }
  return kinds
}

export function scaledEnemyStats(kind: EnemyDefinition['kind'], waveNumber: number, settings: DifficultySettings) {
  const def = ENEMY_DEFINITIONS[kind]
  const waveScale = 1 + (waveNumber - 1) * 0.12
  return {
    maxHealth: Math.round(def.baseHealth * waveScale * settings.enemyHealthMultiplier),
    speed: def.baseSpeed * settings.enemySpeedMultiplier,
    reward: def.reward,
  }
}
