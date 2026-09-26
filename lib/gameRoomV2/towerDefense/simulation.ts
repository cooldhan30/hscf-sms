import { getMap, pathLength, positionAt, TD_MAPS, type Point, type TdMap } from './maps'
import { getTowerType, statsFor, upgradeCost, MAX_TOWER_LEVEL, SELL_REFUND_RATIO, type TargetingMode, type TowerTypeId } from './towers'
import { getDifficultySettings, type TowerDefenseDifficulty } from './difficulty'
import {
  ENEMY_DEFINITIONS,
  BOSS_SUMMON_INTERVAL_MS,
  BOSS_ENRAGE_AT,
  BOSS_ENRAGE_SPEED_MULTIPLIER,
  composeWave,
  waveHealthScale,
  isBossWave,
  isMiniBossWave,
  type EnemyKind,
  type SpawnEntry,
} from './waves'
import {
  getAbility,
  MAX_CHARGES,
  FREEZE_DURATION_MS,
  RALLY_DURATION_MS,
  RALLY_DAMAGE_MULTIPLIER,
  REPAIR_AMOUNT,
  STRIKE_DAMAGE,
  STRIKE_RADIUS,
  type AbilityId,
} from './abilities'
import { mulberry32 } from './rng'

// ---------------------------------------------------------------------------
// Tower Defense simulation. Pure game logic, no DOM: the canvas renderer
// reads this state every frame, the React UI reads a throttled snapshot, and
// scripts/verify-gameroom-v2-tower-defense.ts drives it headlessly.
//
// `step()` mutates the state in place (it runs 30x a second with dozens of
// entities; allocating a new object graph per tick would be wasteful) and
// returns the events that happened during the step for sound/visual feedback.
//
// Economy integrity: coins and scroll charges here are in-match resources
// only. They never touch the database. Everything persistent (score, XP,
// achievements, mastery) is computed by the server from graded answers.
// Answer rewards are granted from the server's grading response.
// ---------------------------------------------------------------------------

export type Phase = 'prep' | 'wave' | 'victory' | 'defeat'

export interface Enemy {
  id: number
  kind: EnemyKind
  dist: number
  x: number
  y: number
  prevX: number
  prevY: number
  hp: number
  maxHp: number
  speed: number
  armor: number
  reward: number
  baseDamage: number
  radius: number
  slowFactor: number
  slowUntil: number
  hitFlashUntil: number
  summonTimer: number
  enraged: boolean
  isBoss: boolean
}

export interface Tower {
  id: number
  padId: string
  x: number
  y: number
  type: TowerTypeId
  level: number
  cooldown: number
  invested: number
  targeting: TargetingMode
  angle: number
  kills: number
  damageDealt: number
  firedAt: number
}

export interface Projectile {
  id: number
  towerType: TowerTypeId
  x: number
  y: number
  prevX: number
  prevY: number
  targetId: number
  tx: number
  ty: number
  speed: number
  damage: number
  splash: number
  pierce: boolean
  ownerId: number
}

export type TdEvent =
  | { type: 'shot'; towerType: TowerTypeId; x: number; y: number }
  | { type: 'hit'; x: number; y: number; damage: number }
  | { type: 'splash'; x: number; y: number; radius: number }
  | { type: 'frostPulse'; x: number; y: number; radius: number }
  | { type: 'kill'; x: number; y: number; reward: number; kind: EnemyKind }
  | { type: 'leak'; damage: number }
  | { type: 'bossSpawn'; mini: boolean }
  | { type: 'bossSummon'; x: number; y: number }
  | { type: 'enrage'; x: number; y: number }
  | { type: 'waveStart'; wave: number; boss: boolean }
  | { type: 'waveCleared'; wave: number; bonus: number }
  | { type: 'victory' }
  | { type: 'defeat' }
  | { type: 'build'; x: number; y: number; towerType: TowerTypeId }
  | { type: 'upgrade'; x: number; y: number; level: number }
  | { type: 'sell'; x: number; y: number; refund: number }
  | { type: 'ability'; ability: AbilityId; x?: number; y?: number }
  | { type: 'reward'; coins: number; charges: number }

export interface TdStats {
  enemiesDefeated: number
  towersBuilt: number
  upgrades: number
  coinsEarned: number
  wavesCleared: number
  leaks: number
  bossDefeated: boolean
  abilitiesUsed: number
  bestStreak: number
}

export interface TdState {
  map: TdMap
  difficulty: TowerDefenseDifficulty
  totalWaves: number
  wave: number // the upcoming (prep) or current (wave) wave, 1-based
  phase: Phase
  coins: number
  baseHp: number
  maxBaseHp: number
  charges: number
  streak: number
  timeMs: number
  waveTimeMs: number
  spawnQueue: SpawnEntry[]
  spawnTimer: number
  nextWave: SpawnEntry[]
  enemies: Enemy[]
  towers: Tower[]
  projectiles: Projectile[]
  cooldowns: Record<AbilityId, number>
  freezeUntil: number
  rallyUntil: number
  nextId: number
  rand: () => number
  stats: TdStats
}

export const STEP_MS = 1000 / 30
export const WAVE_CLEAR_BONUS_BASE = 15
export const WAVE_CLEAR_BONUS_PER_WAVE = 3

export function createTd(opts: { seed: number; difficulty: TowerDefenseDifficulty; totalWaves: number; mapId?: string }): TdState {
  const settings = getDifficultySettings(opts.difficulty)
  const rand = mulberry32(opts.seed)
  const map = opts.mapId ? getMap(opts.mapId) : TD_MAPS[Math.floor(rand() * TD_MAPS.length)]
  const state: TdState = {
    map,
    difficulty: opts.difficulty,
    totalWaves: opts.totalWaves,
    wave: 1,
    phase: 'prep',
    coins: settings.startingCoins,
    baseHp: settings.baseHealth,
    maxBaseHp: settings.baseHealth,
    charges: 0,
    streak: 0,
    timeMs: 0,
    waveTimeMs: 0,
    spawnQueue: [],
    spawnTimer: 0,
    nextWave: [],
    enemies: [],
    towers: [],
    projectiles: [],
    cooldowns: { freeze: 0, rally: 0, repair: 0, strike: 0 },
    freezeUntil: 0,
    rallyUntil: 0,
    nextId: 1,
    rand,
    stats: { enemiesDefeated: 0, towersBuilt: 0, upgrades: 0, coinsEarned: 0, wavesCleared: 0, leaks: 0, bossDefeated: false, abilitiesUsed: 0, bestStreak: 0 },
  }
  state.nextWave = composeWave(1, state.totalWaves, settings, rand)
  return state
}

// --- Player actions ------------------------------------------------------

export type ActionResult = { ok: true } | { ok: false; reason: string }

export function placeTower(state: TdState, padId: string, type: TowerTypeId, events: TdEvent[] = []): ActionResult {
  if (state.phase === 'victory' || state.phase === 'defeat') return { ok: false, reason: 'The battle is over' }
  const pad = state.map.pads.find((p) => p.id === padId)
  if (!pad) return { ok: false, reason: 'Not a build spot' }
  if (state.towers.some((t) => t.padId === padId)) return { ok: false, reason: 'Already built here' }
  const def = getTowerType(type)
  if (state.coins < def.cost) return { ok: false, reason: `Needs ${def.cost} coins` }
  state.coins -= def.cost
  state.towers.push({
    id: state.nextId++,
    padId,
    x: pad.x,
    y: pad.y,
    type,
    level: 1,
    cooldown: 0,
    invested: def.cost,
    targeting: def.defaultTargeting,
    angle: 0,
    kills: 0,
    damageDealt: 0,
    firedAt: -1000,
  })
  state.stats.towersBuilt++
  events.push({ type: 'build', x: pad.x, y: pad.y, towerType: type })
  return { ok: true }
}

export function upgradeTower(state: TdState, towerId: number, events: TdEvent[] = []): ActionResult {
  const t = state.towers.find((tw) => tw.id === towerId)
  if (!t) return { ok: false, reason: 'No tower' }
  if (state.phase === 'victory' || state.phase === 'defeat') return { ok: false, reason: 'The battle is over' }
  const cost = upgradeCost(t.type, t.level)
  if (cost === null) return { ok: false, reason: 'Already max level' }
  if (state.coins < cost) return { ok: false, reason: `Needs ${cost} coins` }
  state.coins -= cost
  t.level++
  t.invested += cost
  state.stats.upgrades++
  events.push({ type: 'upgrade', x: t.x, y: t.y, level: t.level })
  return { ok: true }
}

export function sellValue(t: Tower): number {
  return Math.floor(t.invested * SELL_REFUND_RATIO)
}

export function sellTower(state: TdState, towerId: number, events: TdEvent[] = []): ActionResult {
  const i = state.towers.findIndex((tw) => tw.id === towerId)
  if (i < 0) return { ok: false, reason: 'No tower' }
  if (state.phase === 'victory' || state.phase === 'defeat') return { ok: false, reason: 'The battle is over' }
  const t = state.towers[i]
  const refund = sellValue(t)
  state.coins += refund
  state.towers.splice(i, 1)
  events.push({ type: 'sell', x: t.x, y: t.y, refund })
  return { ok: true }
}

export function setTargeting(state: TdState, towerId: number, mode: TargetingMode): ActionResult {
  const t = state.towers.find((tw) => tw.id === towerId)
  if (!t) return { ok: false, reason: 'No tower' }
  t.targeting = mode
  return { ok: true }
}

export function startWave(state: TdState, events: TdEvent[] = []): ActionResult {
  if (state.phase !== 'prep') return { ok: false, reason: 'A wave is already running' }
  state.phase = 'wave'
  state.spawnQueue = [...state.nextWave]
  state.spawnTimer = 0
  state.waveTimeMs = 0
  const boss = isBossWave(state.wave, state.totalWaves) || isMiniBossWave(state.wave, state.totalWaves)
  events.push({ type: 'waveStart', wave: state.wave, boss })
  return { ok: true }
}

// Reward for a question, from the server's grading of the answer. `points`
// is the server's score for the answer (faster correct answers score higher).
export function grantAnswerReward(state: TdState, result: { correct: boolean; points: number }, events: TdEvent[] = []): { coins: number; charges: number } {
  if (!result.correct) {
    state.streak = 0
    return { coins: 0, charges: 0 }
  }
  state.streak++
  state.stats.bestStreak = Math.max(state.stats.bestStreak, state.streak)
  const speedBonus = Math.max(0, Math.min(20, Math.round((result.points - 1000) / 25)))
  const streakBonus = Math.min(30, (state.streak - 1) * 10)
  const coins = 30 + speedBonus + streakBonus
  const charges = state.streak > 0 && state.streak % 3 === 0 ? 2 : 1
  state.coins += coins
  state.stats.coinsEarned += coins
  const before = state.charges
  state.charges = Math.min(MAX_CHARGES, state.charges + charges)
  events.push({ type: 'reward', coins, charges: state.charges - before })
  return { coins, charges: state.charges - before }
}

export function abilityReady(state: TdState, id: AbilityId): boolean {
  const def = getAbility(id)
  if (state.phase !== 'wave') return false
  if (state.charges < def.charges) return false
  if (state.cooldowns[id] > state.timeMs) return false
  if (id === 'repair' && state.baseHp >= state.maxBaseHp) return false
  return true
}

export function activateAbility(state: TdState, id: AbilityId, target: Point | null, events: TdEvent[] = []): ActionResult {
  const def = getAbility(id)
  if (!abilityReady(state, id)) return { ok: false, reason: 'Not ready' }
  if (def.needsTarget && !target) return { ok: false, reason: 'Choose a spot on the field' }
  state.charges -= def.charges
  state.cooldowns[id] = state.timeMs + def.cooldownMs
  state.stats.abilitiesUsed++
  if (id === 'freeze') state.freezeUntil = state.timeMs + FREEZE_DURATION_MS
  if (id === 'rally') state.rallyUntil = state.timeMs + RALLY_DURATION_MS
  if (id === 'repair') state.baseHp = Math.min(state.maxBaseHp, state.baseHp + REPAIR_AMOUNT)
  if (id === 'strike' && target) {
    for (const e of state.enemies) {
      if (Math.hypot(e.x - target.x, e.y - target.y) <= STRIKE_RADIUS + e.radius) damageEnemy(state, e, STRIKE_DAMAGE, true, events, null)
    }
    cleanupDead(state, events)
  }
  events.push({ type: 'ability', ability: id, x: target?.x, y: target?.y })
  return { ok: true }
}

// --- Simulation step -----------------------------------------------------

function spawnEnemy(state: TdState, kind: EnemyKind, bossScale: number | undefined, atDist: number, events: TdEvent[]) {
  const settings = getDifficultySettings(state.difficulty)
  const def = ENEMY_DEFINITIONS[kind]
  const hp = Math.round(def.hp * waveHealthScale(state.wave) * settings.enemyHealthMultiplier * (kind === 'boss' ? bossScale ?? 1 : 1))
  const pos = positionAt(state.map.path, atDist)
  state.enemies.push({
    id: state.nextId++,
    kind,
    dist: atDist,
    x: pos.x,
    y: pos.y,
    prevX: pos.x,
    prevY: pos.y,
    hp,
    maxHp: hp,
    speed: def.speed * settings.enemySpeedMultiplier,
    armor: def.armor,
    reward: kind === 'boss' ? Math.round(def.reward * (bossScale ?? 1)) : def.reward,
    baseDamage: kind === 'boss' ? Math.max(4, Math.round(def.baseDamage * (bossScale ?? 1))) : def.baseDamage,
    radius: kind === 'boss' ? def.radius * (0.75 + 0.25 * (bossScale ?? 1)) : def.radius,
    slowFactor: 1,
    slowUntil: 0,
    hitFlashUntil: 0,
    summonTimer: BOSS_SUMMON_INTERVAL_MS,
    enraged: false,
    isBoss: kind === 'boss',
  })
  if (kind === 'boss') events.push({ type: 'bossSpawn', mini: (bossScale ?? 1) < 1 })
}

function damageEnemy(state: TdState, e: Enemy, raw: number, pierce: boolean, events: TdEvent[], tower: Tower | null) {
  if (e.hp <= 0) return
  const dealt = pierce ? raw : Math.max(1, raw - e.armor)
  const applied = Math.min(dealt, e.hp)
  e.hp -= dealt
  e.hitFlashUntil = state.timeMs + 90
  if (tower) tower.damageDealt += applied
  events.push({ type: 'hit', x: e.x, y: e.y, damage: Math.round(dealt) })
  if (e.hp <= 0 && tower) tower.kills++
  if (e.isBoss && !e.enraged && e.hp > 0 && e.hp / e.maxHp <= BOSS_ENRAGE_AT) {
    e.enraged = true
    e.speed *= BOSS_ENRAGE_SPEED_MULTIPLIER
    events.push({ type: 'enrage', x: e.x, y: e.y })
  }
}

function cleanupDead(state: TdState, events: TdEvent[]) {
  const alive: Enemy[] = []
  for (const e of state.enemies) {
    if (e.hp <= 0) {
      state.coins += e.reward
      state.stats.coinsEarned += e.reward
      state.stats.enemiesDefeated++
      if (e.isBoss && isBossWave(state.wave, state.totalWaves)) state.stats.bossDefeated = true
      events.push({ type: 'kill', x: e.x, y: e.y, reward: e.reward, kind: e.kind })
    } else alive.push(e)
  }
  state.enemies = alive
}

function pickTarget(state: TdState, t: Tower, range: number): Enemy | null {
  let best: Enemy | null = null
  let bestScore = -Infinity
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - t.x, e.y - t.y)
    if (d > range + e.radius) continue
    const score = t.targeting === 'first' ? e.dist : t.targeting === 'strongest' ? e.hp * 10000 + e.dist : -d
    if (score > bestScore) {
      bestScore = score
      best = e
    }
  }
  return best
}

export function step(state: TdState, dtMs: number = STEP_MS): TdEvent[] {
  const events: TdEvent[] = []
  if (state.phase !== 'wave') return events
  state.timeMs += dtMs
  state.waveTimeMs += dtMs
  const total = pathLength(state.map.path)
  const frozen = state.freezeUntil > state.timeMs

  // Spawning.
  state.spawnTimer += dtMs
  while (state.spawnQueue.length > 0 && state.spawnTimer >= state.spawnQueue[0].delayMs) {
    const entry = state.spawnQueue.shift()!
    state.spawnTimer -= entry.delayMs
    spawnEnemy(state, entry.kind, entry.bossScale, 0, events)
  }

  // Frost shrines slow everything in range.
  for (const t of state.towers) {
    if (t.type !== 'pani') continue
    const s = statsFor(t.type, t.level)
    for (const e of state.enemies) {
      if (Math.hypot(e.x - t.x, e.y - t.y) <= s.range + e.radius) {
        e.slowFactor = Math.min(e.slowFactor, s.slowFactor)
        e.slowUntil = state.timeMs + 250
      }
    }
  }

  // Movement, boss summons and leaks.
  const leaked: Enemy[] = []
  for (const e of state.enemies) {
    e.prevX = e.x
    e.prevY = e.y
    if (e.slowUntil <= state.timeMs) e.slowFactor = 1
    if (!frozen) {
      e.dist += e.speed * e.slowFactor * (dtMs / 1000)
      if (e.isBoss) {
        e.summonTimer -= dtMs
        if (e.summonTimer <= 0) {
          e.summonTimer = BOSS_SUMMON_INTERVAL_MS
          events.push({ type: 'bossSummon', x: e.x, y: e.y })
          for (let i = 0; i < 2; i++) spawnEnemy(state, 'swarm', undefined, Math.max(0, e.dist - 0.3 - i * 0.3), events)
        }
      }
    }
    const p = positionAt(state.map.path, e.dist)
    e.x = p.x
    e.y = p.y
    if (e.dist >= total) leaked.push(e)
  }
  if (leaked.length > 0) {
    for (const e of leaked) {
      state.baseHp = Math.max(0, state.baseHp - e.baseDamage)
      state.stats.leaks++
      events.push({ type: 'leak', damage: e.baseDamage })
    }
    const ids = new Set(leaked.map((e) => e.id))
    state.enemies = state.enemies.filter((e) => !ids.has(e.id))
  }

  // Towers fire.
  const rally = state.rallyUntil > state.timeMs ? RALLY_DAMAGE_MULTIPLIER : 1
  for (const t of state.towers) {
    t.cooldown -= dtMs
    if (t.cooldown > 0) continue
    const s = statsFor(t.type, t.level)
    if (t.type === 'pani') {
      const inRange = state.enemies.filter((e) => Math.hypot(e.x - t.x, e.y - t.y) <= s.range + e.radius)
      if (inRange.length === 0) continue
      for (const e of inRange) damageEnemy(state, e, s.damage * rally, false, events, t)
      events.push({ type: 'frostPulse', x: t.x, y: t.y, radius: s.range })
      t.cooldown = s.fireIntervalMs
      t.firedAt = state.timeMs
      continue
    }
    const target = pickTarget(state, t, s.range)
    if (!target) continue
    t.angle = Math.atan2(target.y - t.y, target.x - t.x)
    t.cooldown = s.fireIntervalMs
    t.firedAt = state.timeMs
    state.projectiles.push({
      id: state.nextId++,
      towerType: t.type,
      x: t.x,
      y: t.y,
      prevX: t.x,
      prevY: t.y,
      targetId: target.id,
      tx: target.x,
      ty: target.y,
      speed: s.projectileSpeed,
      damage: s.damage * rally,
      splash: s.splashRadius,
      pierce: s.armorPiercing,
      ownerId: t.id,
    })
    events.push({ type: 'shot', towerType: t.type, x: t.x, y: t.y })
  }

  // Projectiles travel (homing on their target while it lives).
  const remaining: Projectile[] = []
  for (const pr of state.projectiles) {
    pr.prevX = pr.x
    pr.prevY = pr.y
    const target = state.enemies.find((e) => e.id === pr.targetId && e.hp > 0)
    if (target) {
      pr.tx = target.x
      pr.ty = target.y
    }
    const dx = pr.tx - pr.x
    const dy = pr.ty - pr.y
    const dist = Math.hypot(dx, dy)
    const move = pr.speed * (dtMs / 1000)
    if (dist <= move + 0.05) {
      const owner = state.towers.find((tw) => tw.id === pr.ownerId) ?? null
      if (pr.splash > 0) {
        events.push({ type: 'splash', x: pr.tx, y: pr.ty, radius: pr.splash })
        for (const e of state.enemies) if (Math.hypot(e.x - pr.tx, e.y - pr.ty) <= pr.splash + e.radius) damageEnemy(state, e, pr.damage, pr.pierce, events, owner)
      } else if (target) {
        damageEnemy(state, target, pr.damage, pr.pierce, events, owner)
      }
    } else {
      pr.x += (dx / dist) * move
      pr.y += (dy / dist) * move
      remaining.push(pr)
    }
  }
  state.projectiles = remaining
  cleanupDead(state, events)

  // Outcome.
  if (state.baseHp <= 0) {
    state.phase = 'defeat'
    events.push({ type: 'defeat' })
    return events
  }
  if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
    const bonus = WAVE_CLEAR_BONUS_BASE + WAVE_CLEAR_BONUS_PER_WAVE * state.wave
    state.coins += bonus
    state.stats.coinsEarned += bonus
    state.stats.wavesCleared++
    state.projectiles = []
    events.push({ type: 'waveCleared', wave: state.wave, bonus })
    if (state.wave >= state.totalWaves) {
      state.phase = 'victory'
      events.push({ type: 'victory' })
    } else {
      state.wave++
      state.phase = 'prep'
      state.nextWave = composeWave(state.wave, state.totalWaves, getDifficultySettings(state.difficulty), state.rand)
    }
  }
  return events
}

export function towerAt(state: TdState, padId: string): Tower | undefined {
  return state.towers.find((t) => t.padId === padId)
}

export { MAX_TOWER_LEVEL }
