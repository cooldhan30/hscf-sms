import { getTowerType, upgradedStats, type TowerTypeId } from './towers'
import { getDifficultySettings, type TowerDefenseDifficulty } from './difficulty'
import { pathLength, positionAtDistance, scaledEnemyStats, waveComposition, type EnemyDefinition } from './waves'

// Fixed tower placement pads -- deliberately a small, curated set of
// spots near the path (not free placement anywhere), which keeps the
// board legible on a small tablet screen and keeps balance predictable
// since every session sees the same pad layout.
export const TOWER_PADS: { id: string; x: number; y: number }[] = [
  { id: 'pad-1', x: 1, y: 2.4 },
  { id: 'pad-2', x: 3.2, y: 2.6 },
  { id: 'pad-3', x: 3.6, y: 4.9 },
  { id: 'pad-4', x: 6.2, y: 2.4 },
  { id: 'pad-5', x: 6.8, y: 0.2 },
  { id: 'pad-6', x: 9, y: 3 },
]

export interface EnemyState {
  id: string
  kind: EnemyDefinition['kind']
  distance: number
  health: number
  maxHealth: number
  speed: number
  reward: number
  slowedUntilTick: number
}

export interface PlacedTower {
  padId: string
  typeId: TowerTypeId
  level: number
  cooldownRemainingMs: number
}

export interface ImpactEvent {
  id: string
  padId: string
  enemyId: string
  splash: boolean
}

export interface BattlefieldState {
  difficulty: TowerDefenseDifficulty
  coins: number
  baseHealth: number
  maxBaseHealth: number
  wave: number
  enemiesQueued: EnemyDefinition['kind'][]
  spawnTimerMs: number
  enemies: EnemyState[]
  towers: PlacedTower[]
  tick: number
  waveActive: boolean
  gameOver: boolean
  victory: boolean
  totalWaves: number
}

const SPAWN_INTERVAL_MS = 900
const SPEED_UNITS_PER_MS = 0.0016 // path-units per ms at speed=1

export function createInitialBattlefield(difficulty: TowerDefenseDifficulty, totalWaves: number): BattlefieldState {
  const settings = getDifficultySettings(difficulty)
  return {
    difficulty,
    coins: settings.startingCoins,
    baseHealth: settings.startingLives,
    maxBaseHealth: settings.startingLives,
    wave: 1,
    enemiesQueued: [],
    spawnTimerMs: 0,
    enemies: [],
    towers: [],
    tick: 0,
    waveActive: false,
    gameOver: false,
    victory: false,
    totalWaves,
  }
}

export function startWave(state: BattlefieldState): BattlefieldState {
  if (state.gameOver || state.victory) return state
  const settings = getDifficultySettings(state.difficulty)
  return {
    ...state,
    enemiesQueued: waveComposition(state.wave, settings),
    spawnTimerMs: 0,
    waveActive: true,
  }
}

export function canAffordTower(state: BattlefieldState, typeId: TowerTypeId): boolean {
  return state.coins >= getTowerType(typeId).cost
}

export function placeTower(state: BattlefieldState, padId: string, typeId: TowerTypeId): BattlefieldState {
  if (state.towers.some((t) => t.padId === padId)) return state
  const type = getTowerType(typeId)
  if (state.coins < type.cost) return state
  return {
    ...state,
    coins: state.coins - type.cost,
    towers: [...state.towers, { padId, typeId, level: 1, cooldownRemainingMs: 0 }],
  }
}

export function upgradeTower(state: BattlefieldState, padId: string): BattlefieldState {
  const tower = state.towers.find((t) => t.padId === padId)
  if (!tower) return state
  const type = getTowerType(tower.typeId)
  const cost = Math.round(type.upgradeCost * Math.pow(1.5, tower.level - 1))
  if (state.coins < cost) return state
  return {
    ...state,
    coins: state.coins - cost,
    towers: state.towers.map((t) => (t.padId === padId ? { ...t, level: t.level + 1 } : t)),
  }
}

// A wrong answer's "meaningful but age-appropriate consequence": every
// enemy currently on the path is nudged forward once, and the base
// loses no direct health from this alone (health loss only ever comes
// from an enemy actually completing the path) -- pressure, not
// punishment.
export function applyWrongAnswerConsequence(state: BattlefieldState): BattlefieldState {
  const settings = getDifficultySettings(state.difficulty)
  const total = pathLength()
  return {
    ...state,
    enemies: state.enemies.map((e) => ({ ...e, distance: Math.min(total, e.distance + total * settings.wrongAnswerPushback) })),
  }
}

// A correct answer's reward: coins land immediately, spendable on the
// very next tower placement -- this is what makes "learning matter more
// than twitch speed": towers are unaffordable without answering.
export function applyCorrectAnswerReward(state: BattlefieldState, coins: number): BattlefieldState {
  return { ...state, coins: state.coins + coins }
}

export interface TickResult {
  state: BattlefieldState
  impacts: ImpactEvent[]
  enemiesDefeated: number
  waveCleared: boolean
}

// The single simulation step, called on every animation/interval frame
// with deltaMs. Pure function: same input always produces the same
// output, so it's fully unit-testable without timers or React.
export function tickBattlefield(state: BattlefieldState, deltaMs: number): TickResult {
  if (state.gameOver || state.victory) return { state, impacts: [], enemiesDefeated: 0, waveCleared: false }

  const settings = getDifficultySettings(state.difficulty)
  const total = pathLength()
  let coins = state.coins
  let baseHealth = state.baseHealth
  let enemiesDefeated = 0
  const impacts: ImpactEvent[] = []

  // 1. Spawn queued enemies on a fixed clock.
  let spawnTimerMs = state.spawnTimerMs + deltaMs
  let enemiesQueued = state.enemiesQueued
  const spawned: EnemyState[] = []
  while (enemiesQueued.length > 0 && spawnTimerMs >= SPAWN_INTERVAL_MS) {
    spawnTimerMs -= SPAWN_INTERVAL_MS
    const [kind, ...rest] = enemiesQueued
    enemiesQueued = rest
    const stats = scaledEnemyStats(kind, state.wave, settings)
    spawned.push({
      id: `w${state.wave}-${state.tick}-${enemiesQueued.length}-${kind}`,
      kind,
      distance: 0,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      speed: stats.speed,
      reward: stats.reward,
      slowedUntilTick: 0,
    })
  }

  // 2. Advance every enemy along the path; anything reaching the end
  // damages the base and is removed.
  let enemies = [...state.enemies, ...spawned].map((e) => {
    const slowed = state.towers.some((t) => {
      const type = getTowerType(t.typeId)
      if (type.slowFactor >= 1) return false
      const pos = positionAtDistance(e.distance)
      const pad = TOWER_PADS.find((p) => p.id === t.padId)
      if (!pad) return false
      return Math.hypot(pad.x - pos.x, pad.y - pos.y) <= upgradedStats(type, t.level).range
    })
    const effectiveSpeed = slowed ? e.speed * getTowerType('pani').slowFactor : e.speed
    return { ...e, distance: e.distance + effectiveSpeed * SPEED_UNITS_PER_MS * deltaMs }
  })

  const survivors: EnemyState[] = []
  for (const e of enemies) {
    if (e.distance >= total) {
      baseHealth = Math.max(0, baseHealth - 1)
    } else {
      survivors.push(e)
    }
  }
  enemies = survivors

  // 3. Towers fire at the nearest in-range enemy on their own cooldown.
  const towers = state.towers.map((t) => {
    let cooldown = Math.max(0, t.cooldownRemainingMs - deltaMs)
    const type = getTowerType(t.typeId)
    const stats = upgradedStats(type, t.level)
    const pad = TOWER_PADS.find((p) => p.id === t.padId)
    if (cooldown <= 0 && pad) {
      const target = enemies
        .filter((e) => {
          const pos = positionAtDistance(e.distance)
          return Math.hypot(pad.x - pos.x, pad.y - pos.y) <= stats.range
        })
        .sort((a, b) => b.distance - a.distance)[0]

      if (target) {
        const applyDamage = (id: string) => {
          const en = enemies.find((e) => e.id === id)
          if (!en) return
          en.health -= stats.damage
        }
        applyDamage(target.id)
        impacts.push({ id: `${t.padId}-${target.id}-${state.tick}`, padId: t.padId, enemyId: target.id, splash: type.splashRadius > 0 })

        if (type.splashRadius > 0) {
          const targetPos = positionAtDistance(target.distance)
          for (const other of enemies) {
            if (other.id === target.id) continue
            const otherPos = positionAtDistance(other.distance)
            if (Math.hypot(otherPos.x - targetPos.x, otherPos.y - targetPos.y) <= type.splashRadius) {
              applyDamage(other.id)
            }
          }
        }
        cooldown = stats.fireIntervalMs
      }
    }
    return { ...t, cooldownRemainingMs: cooldown }
  })

  // 4. Remove defeated enemies, award coins.
  const alive: EnemyState[] = []
  for (const e of enemies) {
    if (e.health <= 0) {
      enemiesDefeated++
      coins += e.reward
    } else {
      alive.push(e)
    }
  }

  const waveCleared = state.waveActive && enemiesQueued.length === 0 && alive.length === 0
  const gameOver = baseHealth <= 0
  const victory = !gameOver && waveCleared && state.wave >= state.totalWaves

  const nextState: BattlefieldState = {
    ...state,
    coins,
    baseHealth,
    enemies: alive,
    towers,
    enemiesQueued,
    spawnTimerMs,
    tick: state.tick + 1,
    waveActive: state.waveActive && !waveCleared,
    gameOver,
    victory,
  }

  return { state: nextState, impacts, enemiesDefeated, waveCleared }
}

export function advanceToNextWave(state: BattlefieldState): BattlefieldState {
  if (state.wave >= state.totalWaves) return state
  return { ...state, wave: state.wave + 1, waveActive: false }
}
