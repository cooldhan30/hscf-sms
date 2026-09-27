import { mulberry32 } from '@/lib/gameRoomV2/gameplay/rng'
import { getArena, type Arena, type ArenaId, type Hazard } from './arenas'
import { rollChoices, MAX_LEVEL, type UpgradeChoice, type UpgradeId } from './upgrades'

// Boss Battle -- a real-time top-down arena brawler (pure simulation).
//
// The hero moves; weapons fire on their own; one active skill (Guardian
// Dash). Four waves build toward the bosses: a Stone Guardian closes
// wave 2 and the Irul King is the final, two-phase fight. Kills drop
// sparks (XP); level-ups offer three upgrades. Tamil questions are asked
// at five CHECKPOINTS (after each wave and at the Irul King's phase
// change), never mid-fight: each correct answer heals, and a good
// checkpoint turns its reward into a golden "blessed" upgrade.
//
// Everything here is in-run and client-side by design: movement, combat
// and upgrades are play, not records. Answer correctness is decided by
// the server (QuestionOverlay -> /answer) and only REPORTED into this
// simulation; XP, coins and achievements come from /complete.
//
// Deterministic: fixed 60 Hz steps and a seeded RNG, so
// scripts/verify-gameroom-v2-boss-brawl.ts can drive whole runs.

export const STEP = 1 / 60
export const STEP_MS = 1000 / 60

export type BrawlDifficulty = 'easy' | 'normal' | 'hard'
export type EnemyKind = 'shade' | 'darter' | 'swarm' | 'brute' | 'spitter' | 'golem' | 'irul'
export type BossKind = 'golem' | 'irul'

const DIFF: Record<BrawlDifficulty, { hp: number; dmg: number; spawn: number; boss: number }> = {
  easy: { hp: 0.85, dmg: 0.62, spawn: 0.8, boss: 0.75 },
  normal: { hp: 0.95, dmg: 0.8, spawn: 0.88, boss: 0.9 },
  hard: { hp: 1.15, dmg: 1.05, spawn: 1.05, boss: 1.15 },
}

interface EnemyDef {
  hp: number
  speed: number
  r: number
  dmg: number
  xp: number
}
export const ENEMIES: Record<EnemyKind, EnemyDef & { name: string }> = {
  shade: { name: 'Shade', hp: 22, speed: 88, r: 16, dmg: 7, xp: 1 },
  darter: { name: 'Darter', hp: 14, speed: 160, r: 13, dmg: 5, xp: 1 },
  swarm: { name: 'Mite', hp: 8, speed: 120, r: 10, dmg: 3, xp: 1 },
  brute: { name: 'Brute', hp: 90, speed: 64, r: 28, dmg: 14, xp: 4 },
  spitter: { name: 'Spitter', hp: 30, speed: 82, r: 17, dmg: 6, xp: 2 },
  golem: { name: 'Stone Guardian', hp: 950, speed: 70, r: 46, dmg: 16, xp: 30 },
  irul: { name: 'Irul King', hp: 3400, speed: 58, r: 54, dmg: 18, xp: 0 },
}

export const TOTAL_WAVES = 4
export const BOSS_STAGE = TOTAL_WAVES + 1
// Checkpoints: after waves 1-4, then the Irul King's phase change.
export const CHECKPOINTS = TOTAL_WAVES + 1
const MAX_Q_PER_CHECKPOINT = 4

interface WaveDef {
  seconds: number
  interval: number
  mix: [EnemyKind, number][]
}
const WAVES: WaveDef[] = [
  { seconds: 28, interval: 1.3, mix: [['shade', 6], ['darter', 2]] },
  { seconds: 34, interval: 1.15, mix: [['shade', 4], ['darter', 3], ['swarm', 2], ['spitter', 2]] },
  { seconds: 38, interval: 1.0, mix: [['shade', 3], ['darter', 3], ['swarm', 2], ['spitter', 2], ['brute', 2]] },
  { seconds: 40, interval: 0.9, mix: [['shade', 3], ['darter', 3], ['swarm', 3], ['spitter', 3], ['brute', 3]] },
]
export function waveSeconds(stage: number) {
  return WAVES[Math.max(0, Math.min(WAVES.length - 1, stage - 1))].seconds
}

export interface Enemy {
  id: number
  kind: EnemyKind
  x: number
  y: number
  px: number
  py: number
  kx: number // knockback velocity
  ky: number
  hp: number
  maxHp: number
  r: number
  speed: number
  dmg: number
  xp: number
  flash: number // seconds of hit-flash left
  spawnT: number // seconds of "emerging" left (harmless)
  state: 'move' | 'windup' | 'charge' | 'cast' | 'intro' | 'transition' | 'dying'
  timer: number
  cd: number // ability cooldown
  dx: number // charge direction / cast data
  dy: number
  weave: number
  staffCd: number
  boss?: { phase: 1 | 2; attack: number; invuln: boolean; cast: string; casted: boolean }
}

export interface Bolt {
  id: number
  kind: 'flame' | 'vel'
  x: number
  y: number
  px: number
  py: number
  vx: number
  vy: number
  r: number
  dmg: number
  pierce: number
  life: number
  hit: number[]
}

export interface HostileShot {
  id: number
  x: number
  y: number
  px: number
  py: number
  vx: number
  vy: number
  r: number
  dmg: number
  life: number
}

export interface Ring {
  id: number
  x: number
  y: number
  r: number
  maxR: number
  t: number
  dur: number
  dmg: number
  delay: number
  hit: number[]
}

export interface Warning {
  id: number
  kind: 'circle' | 'line'
  x: number
  y: number
  r: number // circle radius, or line half-width
  x2: number
  y2: number
  t: number
  dur: number
  dmg: number
}

export interface Gem {
  id: number
  x: number
  y: number
  value: number
  pull: boolean
}

export interface Player {
  x: number
  y: number
  px: number
  py: number
  r: number
  hp: number
  invuln: number
  dashT: number
  dashCd: number
  dashX: number
  dashY: number
  fx: number // facing
  fy: number
  moving: boolean
}

export interface Checkpoint {
  index: number // 0-based
  due: number
  answered: number
  correct: number
}

export type BrawlEvent =
  | { type: 'shot'; weapon: 'flame' | 'vel' | 'kural'; x: number; y: number }
  | { type: 'hit'; x: number; y: number; dmg: number; crit: boolean; boss: boolean }
  | { type: 'kill'; kind: EnemyKind; x: number; y: number }
  | { type: 'hurt'; dmg: number; x: number; y: number }
  | { type: 'burn' }
  | { type: 'pickup'; value: number }
  | { type: 'levelUp'; level: number }
  | { type: 'dash'; x: number; y: number }
  | { type: 'spawn'; kind: EnemyKind; x: number; y: number }
  | { type: 'telegraph'; kind: 'brute' | 'spit' | 'slam' | 'charge' | 'volley' | 'summon'; x: number; y: number }
  | { type: 'slam'; x: number; y: number; r: number }
  | { type: 'waveStart'; stage: number }
  | { type: 'waveCleared'; stage: number }
  | { type: 'bossSpawn'; boss: BossKind; x: number; y: number }
  | { type: 'bossLanded'; boss: BossKind; x: number; y: number }
  | { type: 'bossPhase'; x: number; y: number }
  | { type: 'bossDefeated'; boss: BossKind; x: number; y: number }
  | { type: 'checkpoint'; index: number; due: number }
  | { type: 'blessing'; blessed: boolean }
  | { type: 'heal'; amount: number }
  | { type: 'upgrade'; id: UpgradeId; level: number }
  | { type: 'victory' }
  | { type: 'defeat' }

export interface BrawlStats {
  kills: number
  damageDealt: number
  damageTaken: number
  bossesDefeated: number
  timeSeconds: number
  dashes: number
  bestLevel: number
  correct: number
  answered: number
}

export interface BrawlState {
  seed: number
  rand: () => number
  difficulty: BrawlDifficulty
  arena: Arena
  time: number
  stage: number // 1..4 waves, 5 = boss
  status: 'fighting' | 'victory' | 'defeat'
  waveLeft: number // seconds of spawning left in this wave
  spawnT: number
  golemSpawned: boolean
  player: Player
  levels: Partial<Record<UpgradeId, number>>
  level: number
  xp: number
  xpNext: number
  pendingLevelUps: number
  choices: UpgradeChoice[] | null
  afterChoice: 'resume' | 'nextStage'
  checkpoint: Checkpoint | null
  checkpointPlan: number[]
  checkpointsDone: number
  enemies: Enemy[]
  bolts: Bolt[]
  shots: HostileShot[]
  rings: Ring[]
  warnings: Warning[]
  gems: Gem[]
  hazards: Hazard[]
  bossId: number | null
  nextId: number
  cooldowns: { flame: number; vel: number; kural: number }
  burnTick: number
  endTimer: number
  stats: BrawlStats
}

// How many of the session's questions each checkpoint asks. Anything
// beyond MAX_Q_PER_CHECKPOINT x CHECKPOINTS is answered after the run
// ("bank your progress"), exactly like Tower Defense.
export function planCheckpoints(totalQuestions: number): number[] {
  const base = Math.floor(totalQuestions / CHECKPOINTS)
  const extra = totalQuestions % CHECKPOINTS
  return Array.from({ length: CHECKPOINTS }, (_, i) => Math.min(MAX_Q_PER_CHECKPOINT, base + (i < extra ? 1 : 0)))
}

export function xpForLevel(level: number) {
  return 5 + level * 4 + Math.floor(Math.pow(level, 1.5))
}

export function createBrawl(opts: { seed: number; difficulty: BrawlDifficulty; arenaId: ArenaId; totalQuestions: number }): BrawlState {
  const arena = getArena(opts.arenaId)
  const s: BrawlState = {
    seed: opts.seed,
    rand: mulberry32(opts.seed ^ 0x5eed),
    difficulty: opts.difficulty,
    arena,
    time: 0,
    stage: 1,
    status: 'fighting',
    waveLeft: WAVES[0].seconds,
    spawnT: 1.2,
    golemSpawned: false,
    player: { x: arena.playerStart.x, y: arena.playerStart.y, px: arena.playerStart.x, py: arena.playerStart.y, r: 20, hp: 120, invuln: 0, dashT: 0, dashCd: 0, dashX: 0, dashY: -1, fx: 0, fy: -1, moving: false },
    levels: { flame: 1 },
    level: 1,
    xp: 0,
    xpNext: xpForLevel(1),
    pendingLevelUps: 0,
    choices: null,
    afterChoice: 'resume',
    checkpoint: null,
    checkpointPlan: planCheckpoints(opts.totalQuestions),
    checkpointsDone: 0,
    enemies: [],
    bolts: [],
    shots: [],
    rings: [],
    warnings: [],
    gems: [],
    hazards: [...arena.hazards],
    bossId: null,
    nextId: 1,
    cooldowns: { flame: 0.4, vel: 1, kural: 2 },
    burnTick: 0,
    endTimer: 0,
    stats: { kills: 0, damageDealt: 0, damageTaken: 0, bossesDefeated: 0, timeSeconds: 0, dashes: 0, bestLevel: 1, correct: 0, answered: 0 },
  }
  return s
}

// --- Derived stats -------------------------------------------------------

export function playerStats(s: BrawlState) {
  const L = (id: UpgradeId) => s.levels[id] ?? 0
  return {
    dmgMul: 1 + 0.15 * L('might'),
    cdMul: Math.max(0.5, 1 - 0.1 * L('haste')),
    speed: 250 * (1 + 0.1 * L('swift')),
    maxHp: 120 + 20 * L('vitality'),
    armor: 2 * L('armor'),
    crit: 0.05 + 0.06 * L('keen'),
    area: 1 + 0.15 * L('reach'),
    pickup: 90 * (1 + 0.4 * L('magnet')),
    regen: L('renewal'),
    dashCd: 6 * (1 - 0.15 * L('focus')),
  }
}

export function silambuStaffs(s: BrawlState): { x: number; y: number; r: number }[] {
  const L = s.levels.silambu ?? 0
  if (!L) return []
  const st = playerStats(s)
  const n = [1, 2, 2, 3, 4][L - 1]
  const orbit = 82 * st.area * (L >= 3 ? 1.2 : 1)
  const spin = L >= 3 ? 4.2 : 3.2
  const out = []
  for (let k = 0; k < n; k++) {
    const a = s.time * spin + (k * Math.PI * 2) / n
    out.push({ x: s.player.x + Math.cos(a) * orbit, y: s.player.y + Math.sin(a) * orbit, r: 20 * st.area })
  }
  return out
}

export function isPaused(s: BrawlState) {
  return !!s.choices || !!s.checkpoint
}

export function boss(s: BrawlState): Enemy | null {
  return s.bossId === null ? null : s.enemies.find((e) => e.id === s.bossId) ?? null
}

// --- Player actions (outside the step) ----------------------------------

export function chooseUpgrade(s: BrawlState, index: number, ev: BrawlEvent[] = []): boolean {
  const c = s.choices?.[index]
  if (!c) return false
  const before = s.levels[c.id] ?? 0
  s.levels[c.id] = Math.min(MAX_LEVEL, c.toLevel)
  if (c.id === 'vitality') {
    const gained = (s.levels.vitality! - before) * 20
    s.player.hp = Math.min(playerStats(s).maxHp, s.player.hp + gained)
  }
  if (c.blessed) s.player.hp = Math.min(playerStats(s).maxHp, s.player.hp + 20)
  ev.push({ type: 'upgrade', id: c.id, level: s.levels[c.id]! })
  s.choices = null
  if (s.pendingLevelUps > 0) {
    s.pendingLevelUps--
    s.choices = rollChoices(s.levels, s.rand, false)
    return true
  }
  if (s.afterChoice === 'nextStage') {
    s.afterChoice = 'resume'
    startStage(s, s.stage + 1, ev)
  }
  return true
}

// Reports ONE server-graded answer into the current checkpoint.
export function answerCheckpoint(s: BrawlState, correct: boolean, ev: BrawlEvent[] = []): { heal: number } {
  const cp = s.checkpoint
  if (!cp) return { heal: 0 }
  cp.answered++
  s.stats.answered++
  let heal = 0
  if (correct) {
    cp.correct++
    s.stats.correct++
    const st = playerStats(s)
    heal = Math.min(st.maxHp - s.player.hp, Math.round(st.maxHp * 0.15))
    s.player.hp += heal
    if (heal > 0) ev.push({ type: 'heal', amount: heal })
  }
  if (cp.answered >= cp.due) finishCheckpoint(s, ev)
  return { heal }
}

// Closes an open checkpoint early (the session has no questions left to
// ask), scoring it on the answers actually given -- the run never stalls.
export function closeCheckpoint(s: BrawlState, ev: BrawlEvent[] = []) {
  if (s.checkpoint) finishCheckpoint(s, ev)
}

function finishCheckpoint(s: BrawlState, ev: BrawlEvent[]) {
  const cp = s.checkpoint!
  const blessed = cp.due > 0 && cp.correct * 2 >= cp.due
  s.checkpoint = null
  s.checkpointsDone++
  ev.push({ type: 'blessing', blessed })
  s.choices = rollChoices(s.levels, s.rand, blessed)
  if (!s.choices.length) {
    s.choices = null
    if (s.afterChoice === 'nextStage') {
      s.afterChoice = 'resume'
      startStage(s, s.stage + 1, ev)
    }
  }
}

function openCheckpoint(s: BrawlState, after: 'resume' | 'nextStage', ev: BrawlEvent[]) {
  const index = s.checkpointsDone
  const due = s.checkpointPlan[index] ?? 0
  s.afterChoice = after
  s.checkpoint = { index, due, answered: 0, correct: 0 }
  ev.push({ type: 'checkpoint', index, due })
  if (due === 0) finishCheckpoint(s, ev)
}

function startStage(s: BrawlState, stage: number, ev: BrawlEvent[]) {
  s.stage = stage
  s.shots = []
  s.warnings = []
  if (stage <= TOTAL_WAVES) {
    s.waveLeft = WAVES[stage - 1].seconds
    s.spawnT = 0.8
    ev.push({ type: 'waveStart', stage })
    return
  }
  // The final boss.
  const b = spawnEnemy(s, 'irul', s.arena.bossStart.x, s.arena.bossStart.y)
  b.state = 'intro'
  b.timer = 2.4
  b.spawnT = 0
  s.bossId = b.id
  ev.push({ type: 'bossSpawn', boss: 'irul', x: b.x, y: b.y })
}

// --- The step ------------------------------------------------------------

export interface BrawlInput {
  mx: number // desired move direction, length <= 1
  my: number
  dash: boolean
}

export function stepBrawl(s: BrawlState, input: BrawlInput): BrawlEvent[] {
  const ev: BrawlEvent[] = []
  if (s.status !== 'fighting' || isPaused(s)) return ev
  const dt = STEP
  s.time += dt
  s.stats.timeSeconds += dt
  const st = playerStats(s)
  const p = s.player
  p.px = p.x
  p.py = p.y
  for (const e of s.enemies) {
    e.px = e.x
    e.py = e.y
  }
  for (const b of s.bolts) {
    b.px = b.x
    b.py = b.y
  }
  for (const h of s.shots) {
    h.px = h.x
    h.py = h.y
  }

  // Player movement and dash.
  let mx = input.mx
  let my = input.my
  const ml = Math.hypot(mx, my)
  if (ml > 1) {
    mx /= ml
    my /= ml
  }
  p.moving = ml > 0.15
  if (p.moving) {
    const l = Math.hypot(mx, my)
    p.fx = mx / l
    p.fy = my / l
  }
  p.dashCd = Math.max(0, p.dashCd - dt)
  p.invuln = Math.max(0, p.invuln - dt)
  if (input.dash && p.dashCd <= 0 && p.dashT <= 0) {
    p.dashT = 0.18
    p.dashX = p.fx
    p.dashY = p.fy
    p.invuln = Math.max(p.invuln, 0.45)
    p.dashCd = st.dashCd
    s.stats.dashes++
    ev.push({ type: 'dash', x: p.x, y: p.y })
    for (const e of s.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y)
      if (d < 130 * st.area + e.r) {
        damageEnemy(s, e, 12, ev, st)
        if (!e.boss) knock(e, e.x - p.x, e.y - p.y, 420)
      }
    }
  }
  if (p.dashT > 0) {
    p.dashT -= dt
    p.x += p.dashX * 1000 * dt
    p.y += p.dashY * 1000 * dt
  } else {
    p.x += mx * st.speed * dt
    p.y += my * st.speed * dt
  }
  collide(s, p, p.r)

  // Regeneration.
  if (st.regen && p.hp < st.maxHp) p.hp = Math.min(st.maxHp, p.hp + st.regen * dt)

  // Environmental hazards (lava vents, the Irul King's shadow pools).
  let burning = false
  for (const h of s.hazards) if (Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r * 0.4) burning = true
  if (burning && p.dashT <= 0) {
    const dps = Math.max(...s.hazards.filter((h) => Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r * 0.4).map((h) => h.dps))
    p.hp -= dps * dt
    s.stats.damageTaken += dps * dt
    s.burnTick -= dt
    if (s.burnTick <= 0) {
      s.burnTick = 0.4
      ev.push({ type: 'burn' })
    }
    if (p.hp <= 0) return lose(s, ev)
  }

  // Spawning.
  if (s.stage <= TOTAL_WAVES) {
    if (s.waveLeft > 0) {
      s.waveLeft -= dt
      s.spawnT -= dt
      if (s.spawnT <= 0) {
        const w = WAVES[s.stage - 1]
        s.spawnT = w.interval / DIFF[s.difficulty].spawn
        if (s.enemies.length < 70) spawnFromWave(s, w, ev)
      }
      if (s.waveLeft <= 0 && s.stage === 2 && !s.golemSpawned) {
        s.golemSpawned = true
        const g = spawnEnemy(s, 'golem', s.arena.bossStart.x, s.arena.bossStart.y)
        g.spawnT = 1.2
        s.bossId = g.id
        ev.push({ type: 'bossSpawn', boss: 'golem', x: g.x, y: g.y })
      }
    } else if (s.enemies.length === 0) {
      // Wave cleared: every spark flies to the hero, then the checkpoint.
      for (const g of s.gems) g.pull = true
      collectAllGems(s, ev)
      ev.push({ type: 'waveCleared', stage: s.stage })
      openCheckpoint(s, 'nextStage', ev)
      return ev
    }
  }

  // Weapons.
  fireWeapons(s, st, ev)

  // Enemies.
  for (const e of s.enemies) updateEnemy(s, e, st, ev)
  separate(s)

  // Contact damage.
  if (p.invuln <= 0 && p.dashT <= 0) {
    for (const e of s.enemies) {
      if (e.spawnT > 0 || e.state === 'intro' || e.state === 'dying') continue
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r - 4) {
        hurt(s, e.state === 'charge' ? e.dmg * 1.6 : e.dmg, ev)
        if (!e.boss) knock(e, e.x - p.x, e.y - p.y, 260)
        break
      }
    }
  }
  if (p.hp <= 0) return lose(s, ev)

  // Player projectiles.
  for (let i = s.bolts.length - 1; i >= 0; i--) {
    const b = s.bolts[i]
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.life -= dt
    let dead = b.life <= 0
    for (const e of s.enemies) {
      if (dead) break
      if (e.spawnT > 0.25 || b.hit.includes(e.id)) continue
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
        b.hit.push(e.id)
        damageEnemy(s, e, b.dmg, ev, st)
        if (!e.boss) knock(e, b.vx, b.vy, b.kind === 'vel' ? 200 : 110)
        if (b.pierce-- <= 0) dead = true
      }
    }
    if (dead) s.bolts.splice(i, 1)
  }

  // Silambu staffs.
  const staffs = silambuStaffs(s)
  if (staffs.length) {
    const L = s.levels.silambu!
    const dmg = 11 * (L >= 5 ? 1.4 : 1)
    for (const e of s.enemies) {
      e.staffCd = Math.max(0, e.staffCd - dt)
      if (e.staffCd > 0 || e.spawnT > 0.25) continue
      for (const sf of staffs) {
        if (Math.hypot(e.x - sf.x, e.y - sf.y) < e.r + sf.r) {
          damageEnemy(s, e, dmg, ev, st)
          if (!e.boss) knock(e, e.x - p.x, e.y - p.y, 180)
          e.staffCd = 0.35
          break
        }
      }
    }
  }

  // Kural rings.
  for (let i = s.rings.length - 1; i >= 0; i--) {
    const r = s.rings[i]
    if (r.delay > 0) {
      r.delay -= dt
      continue
    }
    r.t += dt
    r.x = p.x
    r.y = p.y
    r.r = r.maxR * Math.min(1, r.t / r.dur)
    for (const e of s.enemies) {
      if (r.hit.includes(e.id) || e.spawnT > 0.25) continue
      const d = Math.hypot(e.x - r.x, e.y - r.y)
      if (d < r.r + e.r) {
        r.hit.push(e.id)
        damageEnemy(s, e, r.dmg, ev, st)
        if (!e.boss) knock(e, e.x - r.x, e.y - r.y, 300)
      }
    }
    if (r.t >= r.dur + 0.15) s.rings.splice(i, 1)
  }

  // Hostile projectiles.
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const h = s.shots[i]
    h.x += h.vx * dt
    h.y += h.vy * dt
    h.life -= dt
    const b = s.arena.bounds
    if (h.life <= 0 || h.x < b.x0 - 80 || h.x > b.x1 + 80 || h.y < b.y0 - 80 || h.y > b.y1 + 80) {
      s.shots.splice(i, 1)
      continue
    }
    if (Math.hypot(h.x - p.x, h.y - p.y) < h.r + p.r - 3) {
      s.shots.splice(i, 1)
      hurt(s, h.dmg, ev)
    }
  }
  if (p.hp <= 0) return lose(s, ev)

  // Telegraphed attacks resolve.
  for (let i = s.warnings.length - 1; i >= 0; i--) {
    const w = s.warnings[i]
    w.t += dt
    if (w.t < w.dur) continue
    s.warnings.splice(i, 1)
    if (w.kind === 'circle') {
      ev.push({ type: 'slam', x: w.x, y: w.y, r: w.r })
      if (Math.hypot(p.x - w.x, p.y - w.y) < w.r + p.r * 0.5) hurt(s, w.dmg, ev)
    }
  }
  if (p.hp <= 0) return lose(s, ev)

  // Deaths, sparks.
  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i]
    if (e.hp > 0 || e.state === 'dying') continue
    if (e.boss) {
      e.state = 'dying'
      e.timer = e.kind === 'irul' ? 2.2 : 1.1
      s.shots = []
      s.warnings = []
      s.stats.bossesDefeated++
      ev.push({ type: 'bossDefeated', boss: e.kind as BossKind, x: e.x, y: e.y })
      continue
    }
    s.enemies.splice(i, 1)
    s.stats.kills++
    ev.push({ type: 'kill', kind: e.kind, x: e.x, y: e.y })
    s.gems.push({ id: s.nextId++, x: e.x, y: e.y, value: e.xp, pull: false })
  }
  // A defeated boss finishes its death, then leaves.
  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i]
    if (e.state !== 'dying') continue
    e.timer -= dt
    if (e.timer > 0) continue
    s.enemies.splice(i, 1)
    s.stats.kills++
    if (e.kind === 'irul') {
      s.bossId = null
      s.status = 'victory'
      ev.push({ type: 'victory' })
      return ev
    }
    s.bossId = null
    for (let k = 0; k < 10; k++) s.gems.push({ id: s.nextId++, x: e.x + (s.rand() - 0.5) * 120, y: e.y + (s.rand() - 0.5) * 80, value: 3, pull: false })
  }

  // Sparks drift to the hero once near.
  for (let i = s.gems.length - 1; i >= 0; i--) {
    const g = s.gems[i]
    const d = Math.hypot(p.x - g.x, p.y - g.y)
    if (d < st.pickup) g.pull = true
    if (g.pull) {
      const sp = Math.max(420, 1400 - d)
      g.x += ((p.x - g.x) / (d || 1)) * sp * dt
      g.y += ((p.y - g.y) / (d || 1)) * sp * dt
    }
    if (d < p.r + 6) {
      s.gems.splice(i, 1)
      gainXp(s, g.value, ev)
    }
  }
  if (s.gems.length > 260) s.gems.splice(0, s.gems.length - 260)
  return ev
}

// --- Helpers -------------------------------------------------------------

function lose(s: BrawlState, ev: BrawlEvent[]) {
  s.player.hp = 0
  s.status = 'defeat'
  ev.push({ type: 'defeat' })
  return ev
}

function hurt(s: BrawlState, raw: number, ev: BrawlEvent[]) {
  const p = s.player
  if (p.invuln > 0 || p.dashT > 0) return
  const st = playerStats(s)
  const dmg = Math.max(1, Math.round(raw * DIFF[s.difficulty].dmg - st.armor))
  p.hp -= dmg
  p.invuln = 0.7
  s.stats.damageTaken += dmg
  ev.push({ type: 'hurt', dmg, x: p.x, y: p.y })
}

function knock(e: Enemy, dx: number, dy: number, force: number) {
  const l = Math.hypot(dx, dy) || 1
  const k = e.kind === 'brute' ? 0.35 : 1
  e.kx += (dx / l) * force * k
  e.ky += (dy / l) * force * k
}

function damageEnemy(s: BrawlState, e: Enemy, base: number, ev: BrawlEvent[], st: ReturnType<typeof playerStats>) {
  if (e.boss?.invuln || e.state === 'intro' || e.state === 'transition' || e.state === 'dying') return
  const crit = s.rand() < st.crit
  const dmg = Math.round(base * st.dmgMul * (crit ? 2 : 1))
  e.hp -= dmg
  e.flash = 0.12
  s.stats.damageDealt += dmg
  ev.push({ type: 'hit', x: e.x, y: e.y, dmg, crit, boss: !!e.boss })
  // The Irul King's second phase begins at half health.
  if (e.kind === 'irul' && e.boss!.phase === 1 && e.hp <= e.maxHp / 2) {
    e.hp = Math.ceil(e.maxHp / 2)
    e.boss!.phase = 2
    e.state = 'transition'
    e.timer = 2.4
    e.boss!.casted = false
    s.shots = []
    s.warnings = []
    ev.push({ type: 'bossPhase', x: e.x, y: e.y })
  }
}

function gainXp(s: BrawlState, v: number, ev: BrawlEvent[]) {
  s.xp += v
  ev.push({ type: 'pickup', value: v })
  while (s.xp >= s.xpNext) {
    s.xp -= s.xpNext
    s.level++
    s.stats.bestLevel = s.level
    s.xpNext = xpForLevel(s.level)
    ev.push({ type: 'levelUp', level: s.level })
    if (s.choices) s.pendingLevelUps++
    else {
      s.choices = rollChoices(s.levels, s.rand, false)
      s.afterChoice = 'resume'
      if (!s.choices.length) s.choices = null
    }
  }
}

function collectAllGems(s: BrawlState, ev: BrawlEvent[]) {
  const total = s.gems.reduce((a, g) => a + g.value, 0)
  s.gems = []
  if (total > 0) gainXp(s, total, ev)
  // Level-ups earned here are offered after the checkpoint's blessing.
  if (s.choices) {
    s.pendingLevelUps++
    s.choices = null
  }
}

function spawnEnemy(s: BrawlState, kind: EnemyKind, x: number, y: number): Enemy {
  const def = ENEMIES[kind]
  const d = DIFF[s.difficulty]
  const scale = kind === 'golem' || kind === 'irul' ? d.boss : d.hp * (1 + 0.18 * (Math.min(s.stage, TOTAL_WAVES) - 1))
  const e: Enemy = {
    id: s.nextId++,
    kind,
    x,
    y,
    px: x,
    py: y,
    kx: 0,
    ky: 0,
    hp: Math.round(def.hp * scale),
    maxHp: Math.round(def.hp * scale),
    r: def.r,
    speed: def.speed,
    dmg: def.dmg,
    xp: def.xp,
    flash: 0,
    spawnT: 0.55,
    state: 'move',
    timer: 0,
    cd: 1.5 + s.rand() * 1.5,
    dx: 0,
    dy: 0,
    weave: s.rand() * Math.PI * 2,
    staffCd: 0,
  }
  if (kind === 'golem' || kind === 'irul') e.boss = { phase: 1, attack: 0, invuln: false, cast: '', casted: false }
  s.enemies.push(e)
  return e
}

function spawnFromWave(s: BrawlState, w: WaveDef, ev: BrawlEvent[]) {
  const total = w.mix.reduce((a, [, n]) => a + n, 0)
  let r = s.rand() * total
  let kind: EnemyKind = w.mix[0][0]
  for (const [k, n] of w.mix) {
    if (r < n) {
      kind = k
      break
    }
    r -= n
  }
  // A gate not right on top of the hero.
  const p = s.player
  const gates = s.arena.spawns.filter((g) => Math.hypot(g.x - p.x, g.y - p.y) > 260)
  const gate = (gates.length ? gates : s.arena.spawns)[Math.floor(s.rand() * (gates.length || s.arena.spawns.length))]
  const count = kind === 'swarm' ? 4 : 1
  for (let k = 0; k < count; k++) {
    const e = spawnEnemy(s, kind, gate.x + (s.rand() - 0.5) * 60, gate.y + (s.rand() - 0.5) * 60)
    clampToBounds(s, e, e.r)
  }
  ev.push({ type: 'spawn', kind, x: gate.x, y: gate.y })
}

function nearestEnemy(s: BrawlState, x: number, y: number, range: number): Enemy | null {
  let best: Enemy | null = null
  let bd = range
  for (const e of s.enemies) {
    if (e.spawnT > 0.3 || e.state === 'dying' || e.state === 'intro') continue
    const d = Math.hypot(e.x - x, e.y - y)
    if (d < bd) {
      bd = d
      best = e
    }
  }
  return best
}

function fireWeapons(s: BrawlState, st: ReturnType<typeof playerStats>, ev: BrawlEvent[]) {
  const p = s.player
  const cd = s.cooldowns
  const dt = STEP
  // Agni Flame: bolts at the nearest enemy.
  const fl = s.levels.flame ?? 0
  cd.flame -= dt
  if (fl && cd.flame <= 0) {
    const t = nearestEnemy(s, p.x, p.y, 720)
    if (t) {
      cd.flame = 0.55 * st.cdMul
      const n = 1 + (fl >= 2 ? 1 : 0) + (fl >= 5 ? 1 : 0)
      const base = Math.atan2(t.y - p.y, t.x - p.x)
      const dmg = 15 * (fl >= 3 ? 1.3 : 1) * (fl >= 5 ? 1.3 : 1)
      for (let k = 0; k < n; k++) {
        const a = base + (k - (n - 1) / 2) * 0.16
        s.bolts.push({ id: s.nextId++, kind: 'flame', x: p.x, y: p.y, px: p.x, py: p.y, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, r: 10, dmg, pierce: fl >= 4 ? 1 : 0, life: 1.1, hit: [] })
      }
      ev.push({ type: 'shot', weapon: 'flame', x: p.x, y: p.y })
    } else cd.flame = 0.1
  }
  // Vel Strike: pierces along the direction the hero faces.
  const vl = s.levels.vel ?? 0
  cd.vel -= dt
  if (vl && cd.vel <= 0) {
    cd.vel = (vl >= 3 ? 1.1 : 1.5) * st.cdMul
    const dmg = 26 * (vl >= 2 ? 1.4 : 1) * (vl >= 5 ? 1.6 : 1)
    const dirs = vl >= 4 ? [1, -1] : [1]
    for (const sgn of dirs) s.bolts.push({ id: s.nextId++, kind: 'vel', x: p.x, y: p.y, px: p.x, py: p.y, vx: p.fx * 950 * sgn, vy: p.fy * 950 * sgn, r: 14, dmg, pierce: 999, life: 0.85, hit: [] })
    ev.push({ type: 'shot', weapon: 'vel', x: p.x, y: p.y })
  }
  // Kural Wave: a ring from the hero.
  const kl = s.levels.kural ?? 0
  cd.kural -= dt
  if (kl && cd.kural <= 0) {
    cd.kural = 3.2 * (kl >= 4 ? 0.7 : 1) * st.cdMul
    const maxR = 150 * st.area * (kl >= 2 ? 1.3 : 1)
    const dmg = 18 * (kl >= 3 ? 1.4 : 1)
    s.rings.push({ id: s.nextId++, x: p.x, y: p.y, r: 0, maxR, t: 0, dur: 0.45, dmg, delay: 0, hit: [] })
    if (kl >= 5) s.rings.push({ id: s.nextId++, x: p.x, y: p.y, r: 0, maxR: maxR * 1.15, t: 0, dur: 0.45, dmg, delay: 0.3, hit: [] })
    ev.push({ type: 'shot', weapon: 'kural', x: p.x, y: p.y })
  }
}

function clampToBounds(s: BrawlState, o: { x: number; y: number }, r: number) {
  const b = s.arena.bounds
  o.x = Math.max(b.x0 + r, Math.min(b.x1 - r, o.x))
  o.y = Math.max(b.y0 + r, Math.min(b.y1 - r, o.y))
}

function collide(s: BrawlState, o: { x: number; y: number }, r: number) {
  for (const ob of s.arena.obstacles) {
    const dx = o.x - ob.x
    const dy = o.y - ob.y
    const d = Math.hypot(dx, dy)
    const min = ob.r + r
    if (d < min) {
      const k = (min - d) / (d || 1)
      o.x += dx * k
      o.y += dy * k
    }
  }
  clampToBounds(s, o, r)
}

function separate(s: BrawlState) {
  const es = s.enemies
  for (let i = 0; i < es.length; i++) {
    const a = es[i]
    if (a.boss) continue
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j]
      if (b.boss) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const min = a.r + b.r
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue
      const d = Math.hypot(dx, dy)
      if (d >= min || d === 0) continue
      const push = ((min - d) / d) * 0.5
      a.x -= dx * push
      a.y -= dy * push
      b.x += dx * push
      b.y += dy * push
    }
  }
}

function moveToward(e: Enemy, tx: number, ty: number, speed: number) {
  const dx = tx - e.x
  const dy = ty - e.y
  const d = Math.hypot(dx, dy) || 1
  e.x += (dx / d) * speed * STEP
  e.y += (dy / d) * speed * STEP
}

function fireAt(s: BrawlState, x: number, y: number, a: number, speed: number, dmg: number, r = 11) {
  s.shots.push({ id: s.nextId++, x, y, px: x, py: y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, dmg, life: 5 })
}

function warn(s: BrawlState, w: Omit<Warning, 'id' | 't'>) {
  s.warnings.push({ ...w, id: s.nextId++, t: 0 })
}

function updateEnemy(s: BrawlState, e: Enemy, st: ReturnType<typeof playerStats>, ev: BrawlEvent[]) {
  const dt = STEP
  const p = s.player
  e.flash = Math.max(0, e.flash - dt)
  if (e.spawnT > 0) {
    e.spawnT -= dt
    return
  }
  if (e.state === 'dying') return
  // Knockback.
  if (e.kx || e.ky) {
    e.x += e.kx * dt
    e.y += e.ky * dt
    e.kx *= 0.86
    e.ky *= 0.86
    if (Math.abs(e.kx) < 2 && Math.abs(e.ky) < 2) e.kx = e.ky = 0
  }
  const dx = p.x - e.x
  const dy = p.y - e.y
  const dist = Math.hypot(dx, dy) || 1
  if (e.boss) {
    updateBoss(s, e, dist, ev)
    if (e.kind === 'golem') collide(s, e, e.r)
    else clampToBounds(s, e, e.r)
    return
  }
  switch (e.kind) {
    case 'darter': {
      e.weave += dt * 7
      const w = Math.sin(e.weave) * 0.9
      const ux = dx / dist
      const uy = dy / dist
      e.x += (ux - uy * w) * e.speed * dt
      e.y += (uy + ux * w) * e.speed * dt
      break
    }
    case 'brute': {
      e.cd -= dt
      if (e.state === 'move') {
        moveToward(e, p.x, p.y, e.speed)
        if (dist < 240 && e.cd <= 0) {
          e.state = 'windup'
          e.timer = 0.7
          e.dx = dx / dist
          e.dy = dy / dist
          ev.push({ type: 'telegraph', kind: 'brute', x: e.x, y: e.y })
        }
      } else if (e.state === 'windup') {
        e.timer -= dt
        if (e.timer <= 0) {
          e.state = 'charge'
          e.timer = 0.55
        }
      } else if (e.state === 'charge') {
        e.timer -= dt
        e.x += e.dx * 480 * dt
        e.y += e.dy * 480 * dt
        if (e.timer <= 0) {
          e.state = 'move'
          e.cd = 3
        }
      }
      break
    }
    case 'spitter': {
      e.cd -= dt
      if (e.state === 'windup') {
        e.timer -= dt
        if (e.timer <= 0) {
          e.state = 'move'
          fireAt(s, e.x, e.y, Math.atan2(dy, dx), 230, 8)
        }
        break
      }
      if (dist < 280) moveToward(e, e.x - dx, e.y - dy, e.speed)
      else if (dist > 380) moveToward(e, p.x, p.y, e.speed)
      else {
        e.weave += dt
        e.x += (-dy / dist) * e.speed * 0.6 * dt * Math.sign(Math.sin(e.weave))
        e.y += (dx / dist) * e.speed * 0.6 * dt * Math.sign(Math.sin(e.weave))
      }
      if (e.cd <= 0 && dist < 600) {
        e.state = 'windup'
        e.timer = 0.45
        e.cd = 2.6
        ev.push({ type: 'telegraph', kind: 'spit', x: e.x, y: e.y })
      }
      break
    }
    case 'swarm': {
      e.weave += dt * 11
      moveToward(e, p.x + Math.sin(e.weave) * 30, p.y + Math.cos(e.weave) * 30, e.speed)
      break
    }
    default:
      moveToward(e, p.x, p.y, e.speed)
  }
  collide(s, e, e.r)
}

// Boss behaviour: telegraph, then act. Phase 2 (Irul King, below half
// health) is faster, adds a charge and a spiral, and fills the arena
// with shadow pools.
function updateBoss(s: BrawlState, e: Enemy, dist: number, ev: BrawlEvent[]) {
  const dt = STEP
  const p = s.player
  const b = e.boss!
  const dx = p.x - e.x
  const dy = p.y - e.y
  if (e.state === 'intro') {
    b.invuln = true
    e.timer -= dt
    if (e.timer <= 0) {
      b.invuln = false
      e.state = 'move'
      e.cd = 1.4
      // Landing shockwave: pushes the hero back, no damage.
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1
      if (d < 260) {
        p.x += ((p.x - e.x) / d) * (260 - d)
        p.y += ((p.y - e.y) / d) * (260 - d)
        collide(s, p, p.r)
      }
      ev.push({ type: 'bossLanded', boss: e.kind as BossKind, x: e.x, y: e.y })
    }
    return
  }
  if (e.state === 'transition') {
    b.invuln = true
    e.timer -= dt
    // Halfway through the roar: the phase-change checkpoint.
    if (!b.casted && e.timer <= 1.2) {
      b.casted = true
      const pools = [
        { x: s.arena.bounds.x0 + 260, y: s.arena.bounds.y0 + 220 },
        { x: s.arena.bounds.x1 - 260, y: s.arena.bounds.y0 + 220 },
        { x: s.arena.bounds.x0 + 300, y: s.arena.bounds.y1 - 200 },
        { x: s.arena.bounds.x1 - 300, y: s.arena.bounds.y1 - 200 },
      ]
      for (const pl of pools) s.hazards.push({ x: pl.x, y: pl.y, r: 62, dps: 12 })
      openCheckpoint(s, 'resume', ev)
    }
    if (e.timer <= 0) {
      b.invuln = false
      e.state = 'move'
      e.speed = 82
      e.cd = 1
    }
    return
  }
  const phase2 = b.phase === 2
  if (e.state === 'charge') {
    e.timer -= dt
    e.x += e.dx * 820 * dt
    e.y += e.dy * 820 * dt
    if (e.timer <= 0) {
      e.state = 'move'
      e.cd = phase2 ? 1.2 : 1.8
    }
    return
  }
  if (e.state === 'cast') {
    e.timer -= dt
    if (e.timer > 0) return
    e.state = 'move'
    const cast = b.cast
    if (cast === 'volley' || cast === 'spiral') {
      const n = phase2 ? 14 : 12
      const off = s.rand() * Math.PI
      for (let k = 0; k < n; k++) fireAt(s, e.x, e.y, off + (k / n) * Math.PI * 2, 200, 10, 13)
      if (cast === 'spiral') for (let k = 0; k < n; k++) fireAt(s, e.x, e.y, off + ((k + 0.5) / n) * Math.PI * 2, 150, 10, 13)
    } else if (cast === 'summon') {
      const kind: EnemyKind = phase2 ? 'darter' : 'shade'
      for (let k = 0; k < (phase2 ? 5 : 4); k++) {
        const a = (k / 4) * Math.PI * 2 + s.rand()
        const m = spawnEnemy(s, kind, e.x + Math.cos(a) * 110, e.y + Math.sin(a) * 90)
        clampToBounds(s, m, m.r)
      }
      ev.push({ type: 'spawn', kind, x: e.x, y: e.y })
    } else if (cast === 'charge') {
      e.state = 'charge'
      e.timer = 0.62
    }
    e.cd = (phase2 ? 1.7 : 2.5) * (s.difficulty === 'easy' ? 1.25 : 1)
    return
  }
  // Moving: drift toward the hero, then pick the next attack.
  if (dist > e.r + p.r) {
    e.x += (dx / dist) * e.speed * dt
    e.y += (dy / dist) * e.speed * dt
  }
  e.cd -= dt
  if (e.cd > 0) return
  const golemCycle = ['slam', 'charge']
  const p1 = ['slam', 'volley', 'summon', 'slam', 'volley']
  const p2 = ['slam3', 'spiral', 'charge', 'slam3', 'summon', 'charge']
  const cycle = e.kind === 'golem' ? golemCycle : phase2 ? p2 : p1
  const move = cycle[b.attack++ % cycle.length]
  const dmgScale = e.kind === 'golem' ? 0.85 : 1
  if (move === 'slam' || move === 'slam3') {
    const r = e.kind === 'golem' ? 110 : 125
    warn(s, { kind: 'circle', x: p.x, y: p.y, r, x2: 0, y2: 0, dur: 1.0, dmg: 22 * dmgScale })
    if (move === 'slam3') {
      // Two more, where the hero is likely to step next.
      for (const k of [1, 2]) {
        const ang = Math.atan2(p.fy, p.fx) + (k === 1 ? 0.6 : -0.6)
        warn(s, { kind: 'circle', x: p.x + Math.cos(ang) * 180, y: p.y + Math.sin(ang) * 180, r: 110, x2: 0, y2: 0, dur: 1.0 + k * 0.3, dmg: 20 })
      }
    }
    e.state = 'cast'
    b.cast = 'slam'
    e.timer = 0.5
    ev.push({ type: 'telegraph', kind: 'slam', x: p.x, y: p.y })
  } else if (move === 'charge') {
    e.dx = dx / dist
    e.dy = dy / dist
    const len = Math.min(700, dist + 200)
    warn(s, { kind: 'line', x: e.x, y: e.y, r: e.r * 0.9, x2: e.x + e.dx * len, y2: e.y + e.dy * len, dur: 0.85, dmg: 0 })
    e.state = 'cast'
    b.cast = 'charge'
    e.timer = 0.85
    ev.push({ type: 'telegraph', kind: 'charge', x: e.x, y: e.y })
  } else {
    e.state = 'cast'
    b.cast = move
    e.timer = move === 'summon' ? 0.9 : 0.7
    ev.push({ type: 'telegraph', kind: move === 'summon' ? 'summon' : 'volley', x: e.x, y: e.y })
  }
}
