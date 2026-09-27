// Solo Boss Battle -- the real-time arena brawler -- driven headlessly
// against the real simulation (lib/gameRoomV2/bossBattle/brawl):
//   1. arenas: four distinct, valid layouts
//   2. movement, obstacles, bounds, dash
//   3. weapons fire and kill; sparks -> level-up -> upgrade choices
//   4. upgrade rolls (distinct, no maxed, weapon slots, blessed = +2)
//   5. damage: contact, invulnerability frames, armour, hazards
//   6. checkpoints: planning, healing, golden blessing, early close
//   7. waves, Stone Guardian, Irul King entrance, phase 2, victory, defeat
//   8. determinism and balance across difficulties
//   9. learning/security boundaries in the client code
//  10. the music scores are valid
//
//   npx tsx scripts/verify-gameroom-v2-boss-brawl.ts
import { readFileSync } from 'fs'
import {
  ARENAS,
  WORLD_W,
  WORLD_H,
  UPGRADES,
  MAX_LEVEL,
  MAX_WEAPONS,
  CHECKPOINTS,
  TOTAL_WAVES,
  BOSS_STAGE,
  createBrawl,
  stepBrawl,
  chooseUpgrade,
  answerCheckpoint,
  closeCheckpoint,
  planCheckpoints,
  rollChoices,
  playerStats,
  isPaused,
  boss,
  type BrawlState,
  type BrawlDifficulty,
  type BrawlEvent,
  type UpgradeId,
} from '../lib/gameRoomV2/bossBattle/brawl'
import { mulberry32 } from '../lib/gameRoomV2/gameplay/rng'

let failures = 0
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok: ${msg}`)
  else {
    failures++
    console.error(`  FAIL: ${msg}`)
  }
}
const read = (f: string) => readFileSync(f, 'utf8')
const idle = { mx: 0, my: 0, dash: false }
function run(s: BrawlState, steps: number, input = idle): BrawlEvent[] {
  const all: BrawlEvent[] = []
  for (let i = 0; i < steps && s.status === 'fighting' && !isPaused(s); i++) all.push(...stepBrawl(s, input))
  return all
}
const fresh = (over: Partial<{ seed: number; difficulty: BrawlDifficulty; arena: (typeof ARENAS)[number]['id']; q: number }> = {}) =>
  createBrawl({ seed: over.seed ?? 7, difficulty: over.difficulty ?? 'normal', arenaId: over.arena ?? 'temple', totalQuestions: over.q ?? 15 })

console.log('\n== 1. Arenas ==')
assert(ARENAS.length === 4 && new Set(ARENAS.map((a) => a.id)).size === 4, 'four arenas with distinct ids')
for (const a of ARENAS) {
  const b = a.bounds
  const inB = (x: number, y: number) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1
  assert(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= WORLD_W && b.y1 <= WORLD_H && b.x1 - b.x0 > 1000 && b.y1 - b.y0 > 500, `${a.name}: bounds fit the world and leave room to fight`)
  assert(a.spawns.length >= 4 && a.spawns.every((sp) => inB(sp.x, sp.y)), `${a.name}: at least four spawn gates, all inside the arena`)
  assert(a.obstacles.every((o) => inB(o.x, o.y)), `${a.name}: obstacles are inside the arena`)
  const clear = (x: number, y: number, r: number) => a.obstacles.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r) && a.hazards.every((h) => Math.hypot(h.x - x, h.y - y) > h.r + r)
  assert(clear(a.playerStart.x, a.playerStart.y, 60) && inB(a.playerStart.x, a.playerStart.y), `${a.name}: the hero starts in the open, away from hazards`)
  assert(a.spawns.every((sp) => Math.hypot(sp.x - a.playerStart.x, sp.y - a.playerStart.y) > 200), `${a.name}: no gate spawns on top of the hero`)
}
const layouts = ARENAS.map((a) => JSON.stringify([a.bounds, a.obstacles.map((o) => [o.x, o.y]), a.spawns]))
assert(new Set(layouts).size === 4, 'every arena has its own layout (not a recolour)')
assert(ARENAS.find((a) => a.id === 'volcano')!.hazards.length > 0, 'the Volcanic Citadel has lava hazards')

console.log('\n== 2. Movement, obstacles, dash ==')
{
  const s = fresh()
  const x0 = s.player.x
  run(s, 30, { mx: 1, my: 0, dash: false })
  assert(Math.abs(s.player.x - x0 - 250 * 0.5) < 3, 'the hero moves at 250 units/s')
  const s2 = fresh()
  run(s2, 60 * 10, { mx: -1, my: -1, dash: false })
  assert(s2.player.x >= s2.arena.bounds.x0 + s2.player.r - 0.01 && s2.player.y >= s2.arena.bounds.y0 + s2.player.r - 0.01, 'the arena bounds hold the hero in')
  const s3 = fresh()
  const pillar = s3.arena.obstacles[0]
  s3.player.x = pillar.x + 200
  s3.player.y = pillar.y
  run(s3, 120, { mx: -1, my: 0, dash: false })
  assert(Math.hypot(s3.player.x - pillar.x, s3.player.y - pillar.y) >= pillar.r + s3.player.r - 0.5, 'obstacles are solid')
  const s4 = fresh()
  const before = s4.player.x
  run(s4, 1, { mx: 1, my: 0, dash: true })
  run(s4, 12, { mx: 1, my: 0, dash: false })
  assert(s4.stats.dashes === 1 && s4.player.x - before > 180, 'Guardian Dash bursts forward')
  assert(s4.player.dashCd > 0, 'the dash then recharges')
  run(s4, 1, { mx: 1, my: 0, dash: true })
  assert(s4.stats.dashes === 1, 'no second dash while recharging')
}

console.log('\n== 3. Weapons, sparks, level-ups ==')
{
  const s = fresh({ seed: 3 })
  const ev = run(s, 60 * 12)
  assert(ev.some((e) => e.type === 'shot' && e.weapon === 'flame'), 'Agni Flame fires on its own')
  assert(ev.some((e) => e.type === 'kill') && s.stats.kills > 0, 'enemies are defeated')
  const g = fresh({ seed: 4 })
  g.xp = g.xpNext - 1
  g.gems.push({ id: 99999, x: g.player.x + 3, y: g.player.y, value: 2, pull: true })
  const e2 = run(g, 5)
  assert(e2.some((e) => e.type === 'levelUp') && g.level === 2, 'collecting sparks levels the hero up')
  assert(isPaused(g) && g.choices?.length === 3, 'a level-up pauses the fight and offers three upgrades')
  const t = g.time
  stepBrawl(g, idle)
  assert(g.time === t, 'nothing moves while choosing')
  const pick = g.choices![0]
  chooseUpgrade(g, 0)
  assert(g.levels[pick.id] === pick.toLevel && !isPaused(g), 'choosing applies the upgrade and resumes')
  // Every weapon actually does something.
  for (const w of ['silambu', 'vel', 'kural'] as UpgradeId[]) {
    const s2 = fresh({ seed: 11 })
    s2.levels = { [w]: 1 }
    const evw = run(s2, 60 * 15)
    assert(evw.some((e) => e.type === 'hit'), `${UPGRADES.find((u) => u.id === w)!.name} damages enemies`)
  }
}

console.log('\n== 4. Upgrade rolls ==')
{
  const r = mulberry32(5)
  let ok = true
  let blessedOk = true
  for (let i = 0; i < 200; i++) {
    const levels: Partial<Record<UpgradeId, number>> = {}
    for (const u of UPGRADES) if (r() < 0.4) levels[u.id] = 1 + Math.floor(r() * MAX_LEVEL)
    const c = rollChoices(levels, r, i % 2 === 0)
    if (new Set(c.map((x) => x.id)).size !== c.length) ok = false
    if (c.some((x) => (levels[x.id] ?? 0) >= MAX_LEVEL)) ok = false
    const owned = UPGRADES.filter((u) => u.kind === 'weapon' && (levels[u.id] ?? 0) > 0).length
    if (owned >= MAX_WEAPONS && c.some((x) => UPGRADES.find((u) => u.id === x.id)!.kind === 'weapon' && !(levels[x.id] ?? 0))) ok = false
    if (i % 2 === 0 && c.some((x) => x.toLevel !== Math.min(MAX_LEVEL, (levels[x.id] ?? 0) + 2))) blessedOk = false
  }
  assert(ok, 'choices are distinct, never maxed, and respect the weapon slots')
  assert(blessedOk, 'a golden (blessed) choice grants two levels')
  const all: Partial<Record<UpgradeId, number>> = {}
  for (const u of UPGRADES) all[u.id] = MAX_LEVEL
  assert(rollChoices(all, r, false).length === 0, 'nothing is offered once everything is maxed')
}

console.log('\n== 5. Damage ==')
{
  const s = fresh()
  s.enemies = []
  s.waveLeft = 99
  s.spawnT = 99
  const sh = s.player
  s.shots.push({ id: 1, x: sh.x - 30, y: sh.y, px: sh.x - 30, py: sh.y, vx: 300, vy: 0, r: 10, dmg: 10, life: 3 })
  const ev = run(s, 20)
  const hurt = ev.find((e) => e.type === 'hurt') as { dmg: number } | undefined
  assert(!!hurt && sh.hp < 120, 'hostile shots hurt the hero')
  const hp = sh.hp
  s.shots.push({ id: 2, x: sh.x - 20, y: sh.y, px: sh.x - 20, py: sh.y, vx: 300, vy: 0, r: 10, dmg: 10, life: 3 })
  run(s, 5)
  assert(sh.hp === hp, 'brief invulnerability after a hit')
  const a = fresh()
  a.levels.armor = 3
  a.enemies = []
  a.spawnT = 99
  a.shots.push({ id: 3, x: a.player.x - 30, y: a.player.y, px: a.player.x - 30, py: a.player.y, vx: 300, vy: 0, r: 10, dmg: 10, life: 3 })
  run(a, 20)
  assert(120 - a.player.hp === Math.max(1, Math.round(10 * 0.8) - 6), 'armour reduces each hit')
  const d = fresh()
  d.enemies = []
  d.spawnT = 99
  run(d, 1, { mx: 1, my: 0, dash: true })
  d.shots.push({ id: 4, x: d.player.x, y: d.player.y, px: d.player.x, py: d.player.y, vx: 0, vy: 0, r: 30, dmg: 50, life: 3 })
  run(d, 3)
  assert(d.player.hp === 120, 'the hero cannot be hurt mid-dash')
  const v = fresh({ arena: 'volcano' })
  const lava = v.arena.hazards[0]
  v.player.x = lava.x
  v.player.y = lava.y
  v.spawnT = 99
  run(v, 60)
  assert(v.player.hp < 120 - 5, 'standing in lava burns')
}

console.log('\n== 6. Checkpoints ==')
{
  assert(planCheckpoints(15).join() === '3,3,3,3,3', '15 questions: three at each of the five checkpoints')
  assert(planCheckpoints(7).join() === '2,2,1,1,1' && planCheckpoints(7).reduce((a, b) => a + b, 0) === 7, 'uneven counts spread over the early checkpoints')
  assert(planCheckpoints(40).every((n) => n <= 4), 'a checkpoint never asks more than four (the rest are asked after the run)')
  assert(planCheckpoints(3).filter((n) => n === 0).length === 2, 'a short set still works (some checkpoints ask none)')
  const s = fresh()
  s.waveLeft = 0.01
  s.enemies = []
  s.spawnT = 99
  run(s, 3)
  assert(!!s.checkpoint && s.checkpoint.due === 3, 'clearing wave 1 opens a checkpoint with its questions')
  assert(isPaused(s), 'the fight is paused during the checkpoint')
  s.player.hp = 50
  const r1 = answerCheckpoint(s, true)
  assert(r1.heal > 0 && s.player.hp === 50 + r1.heal, 'a correct answer heals')
  const hp = s.player.hp
  answerCheckpoint(s, false)
  assert(s.player.hp === hp, 'a wrong answer costs nothing')
  answerCheckpoint(s, true)
  assert(!s.checkpoint && s.choices?.every((c) => c.blessed), '2 of 3 correct -> golden upgrade choices')
  chooseUpgrade(s, 0)
  assert(s.stage === 2 && !isPaused(s), 'after the reward the next wave starts')
  const w = fresh()
  w.waveLeft = 0.01
  w.enemies = []
  w.spawnT = 99
  run(w, 3)
  answerCheckpoint(w, false)
  answerCheckpoint(w, false)
  answerCheckpoint(w, true)
  assert(w.choices?.every((c) => !c.blessed), '1 of 3 correct -> normal choices (still a reward, no punishment)')
  const c = fresh()
  c.waveLeft = 0.01
  c.enemies = []
  c.spawnT = 99
  run(c, 3)
  answerCheckpoint(c, true)
  closeCheckpoint(c)
  assert(!c.checkpoint && !!c.choices, 'a checkpoint can close early if the session runs out of questions')
}

console.log('\n== 7. Waves and bosses ==')
{
  const s = fresh({ seed: 21 })
  s.player.hp = 1e6
  s.stage = 2
  s.waveLeft = 0.05
  const ev = run(s, 10)
  assert(ev.some((e) => e.type === 'bossSpawn' && e.boss === 'golem') && boss(s)?.kind === 'golem', 'the Stone Guardian closes wave 2')
  const e2 = run(s, 60 * 8)
  assert(e2.some((e) => e.type === 'telegraph' && (e.kind === 'slam' || e.kind === 'charge')), 'the Guardian telegraphs its attacks')
  // Straight to the Irul King.
  const k = fresh({ seed: 22 })
  k.player.hp = 1e6
  k.stage = TOTAL_WAVES
  k.waveLeft = 0.01
  k.enemies = []
  k.spawnT = 99
  k.checkpointsDone = 3
  run(k, 3)
  while (k.checkpoint) answerCheckpoint(k, true)
  while (k.choices) chooseUpgrade(k, 0)
  const b = boss(k)!
  assert(k.stage === BOSS_STAGE && b?.kind === 'irul' && b.state === 'intro', 'wave 4 cleared -> the Irul King makes his entrance')
  const hp0 = b.hp
  run(k, 30)
  assert(b.hp === hp0, 'the boss cannot be hurt during his entrance')
  const e3 = run(k, 60 * 3)
  assert(e3.some((e) => e.type === 'bossLanded'), 'he lands with a shockwave')
  const e4 = run(k, 60 * 12)
  const kinds = new Set(e4.filter((e) => e.type === 'telegraph').map((e) => (e as { kind: string }).kind))
  assert(kinds.has('slam') && kinds.has('volley') && kinds.has('summon'), `phase 1 uses slam, volley and summon (${Array.from(kinds).join(', ')})`)
  b.hp = Math.floor(b.maxHp / 2) + 1
  k.enemies.forEach((e) => (e.spawnT = 0))
  let phaseEv: BrawlEvent[] = []
  for (let i = 0; i < 600 && b.boss!.phase === 1; i++) phaseEv = phaseEv.concat(stepBrawl(k, idle))
  assert(b.boss!.phase === 2 && phaseEv.some((e) => e.type === 'bossPhase'), 'at half health he enters phase 2')
  run(k, 120)
  const phaseCp = k.checkpoint as { index: number } | null
  assert(!!phaseCp && phaseCp.index === 4, 'the phase change opens the last checkpoint')
  const pools = k.hazards.length
  assert(pools >= 4, 'phase 2 fills the arena with shadow pools')
  while (k.checkpoint) answerCheckpoint(k, true)
  while (k.choices) chooseUpgrade(k, 0)
  const e5 = run(k, 60 * 14)
  const k2 = new Set(e5.filter((e) => e.type === 'telegraph').map((e) => (e as { kind: string }).kind))
  assert(k2.has('charge') && k2.has('slam'), `phase 2 adds charges (${Array.from(k2).join(', ')})`)
  b.hp = 1
  const e6 = run(k, 60 * 5, { mx: 0, my: 0, dash: false })
  assert(e6.some((e) => e.type === 'bossDefeated') && e6.some((e) => e.type === 'victory') && k.status === 'victory', 'defeating him plays his defeat, then victory')
  const d = fresh()
  d.player.hp = 1
  d.shots.push({ id: 9, x: d.player.x, y: d.player.y, px: d.player.x, py: d.player.y, vx: 0, vy: 0, r: 30, dmg: 50, life: 3 })
  const e7 = run(d, 3)
  assert(d.status === 'defeat' && e7.some((e) => e.type === 'defeat'), 'health 0 -> defeat')
  run(d, 10)
  assert(d.status === 'defeat', 'nothing happens after the run ends')
}

console.log('\n== 8. Determinism and balance ==')
function bot(seed: number, diff: BrawlDifficulty, acc: number, skill: 'good' | 'idle') {
  const s = createBrawl({ seed, difficulty: diff, arenaId: ARENAS[seed % 4].id, totalQuestions: 15 })
  const r = mulberry32(seed * 7)
  const pref = ['flame', 'silambu', 'kural', 'vel', 'might', 'haste', 'vitality', 'armor', 'reach', 'renewal', 'keen', 'swift', 'magnet', 'focus']
  let steps = 0
  while (s.status === 'fighting' && steps < 60 * 900) {
    if (s.checkpoint) {
      answerCheckpoint(s, r() < acc)
      continue
    }
    if (s.choices) {
      const i = skill === 'good' ? s.choices.map((c, j) => [pref.indexOf(c.id), j]).sort((a, b) => a[0] - b[0])[0][1] : Math.floor(r() * s.choices.length)
      chooseUpgrade(s, i)
      continue
    }
    let mx = 0
    let my = 0
    let dash = false
    if (skill === 'good') {
      const p = s.player
      for (const e of s.enemies) {
        const dx = p.x - e.x
        const dy = p.y - e.y
        const d = Math.hypot(dx, dy) || 1
        const w = (e.boss ? 3 : 1) / Math.max(40, d - e.r)
        mx += (dx / d) * w * 60
        my += (dy / d) * w * 60
      }
      for (const h of s.shots) {
        const dx = p.x - h.x
        const dy = p.y - h.y
        const d = Math.hypot(dx, dy) || 1
        if (d < 160) {
          mx += (dx / d) * 1.5
          my += (dy / d) * 1.5
        }
      }
      for (const w of s.warnings)
        if (w.kind === 'circle') {
          const dx = p.x - w.x
          const dy = p.y - w.y
          const d = Math.hypot(dx, dy) || 1
          if (d < w.r + 40) {
            mx += (dx / d) * 3
            my += (dy / d) * 3
          }
        }
      for (const h of s.hazards) {
        const dx = p.x - h.x
        const dy = p.y - h.y
        const d = Math.hypot(dx, dy) || 1
        if (d < h.r + 60) {
          mx += (dx / d) * 2
          my += (dy / d) * 2
        }
      }
      mx += (800 - p.x) / 900
      my += (540 - p.y) / 700
      const l = Math.hypot(mx, my)
      if (l > 0) {
        mx /= l
        my /= l
      }
      dash = p.hp < 45 && s.enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 90)
    }
    stepBrawl(s, { mx, my, dash })
    steps++
  }
  return s
}
{
  const a = bot(5, 'normal', 0.7, 'good')
  const b = bot(5, 'normal', 0.7, 'good')
  assert(a.status === b.status && a.stats.kills === b.stats.kills && a.time === b.time, 'the same seed plays out identically')
  const rate = (diff: BrawlDifficulty, acc: number, skill: 'good' | 'idle') => Array.from({ length: 10 }, (_, i) => bot(300 + i, diff, acc, skill)).filter((s) => s.status === 'victory').length / 10
  const easyGood = rate('easy', 0.6, 'good')
  const normalGood = rate('normal', 0.8, 'good')
  const normalIdle = rate('normal', 0.8, 'idle')
  const hardGood = rate('hard', 0.8, 'good')
  console.log(`    win rates: easy/good ${easyGood}, normal/good ${normalGood}, normal/idle ${normalIdle}, hard/good ${hardGood}`)
  assert(easyGood >= 0.8, 'Easy: a player who moves sensibly almost always wins')
  assert(normalGood >= 0.6, 'Normal: a good player usually wins')
  assert(normalIdle <= 0.5, 'Normal: standing still usually loses (movement matters)')
  assert(hardGood < normalGood, 'Hard is harder than Normal')
  const full = bot(301, 'normal', 1, 'good')
  assert(full.stats.answered === 15 || full.status === 'defeat', 'a full run asks every planned checkpoint question')
  assert(playerStats(full).maxHp >= 120, 'derived stats are sane')
}

console.log('\n== 9. Learning and security boundaries ==')
{
  const game = read('components/gameRoomV2/bossBattle/brawl/BrawlGame.tsx')
  const brawlLib = ['sim.ts', 'upgrades.ts', 'arenas.ts', 'index.ts'].map((f) => read(`lib/gameRoomV2/bossBattle/brawl/${f}`)).join('\n')
  const client = ['BrawlCanvas.tsx', 'BrawlSetup.tsx', 'BrawlResults.tsx', 'art.ts', 'scenery.ts', 'music.ts'].map((f) => read(`components/gameRoomV2/bossBattle/brawl/${f}`)).join('\n')
  assert(/<QuestionOverlay[^>]*onResult=\{handleAnswer\}/.test(game), 'questions go through the shared, server-graded QuestionOverlay')
  assert(/useQuestionGate\(/.test(game), 'the session is paused server-side whenever no question is shown')
  assert(/answerCheckpoint\(st, res\.correct/.test(game), 'the simulation only hears the server-graded result')
  assert(!/fetch\(|supabase|createClient|service_role/i.test(brawlLib + client + game.replace(/useGameSessionState[^\n]*/g, '')), 'no direct network/database access in the brawl code')
  assert(!/xpEarned\s*=|coinsEarned\s*=|achievement.*=\s*true/i.test(brawlLib + game), 'the client never computes persistent XP, coins or achievements')
  assert(/result\.xpEarned/.test(read('components/gameRoomV2/bossBattle/brawl/BrawlResults.tsx')), 'results show the server /complete XP')
  assert(!/correctAnswer|answerKey|isCorrect/.test(brawlLib), 'the simulation never sees an answer key')
  const bb = read('components/gameRoomV2/bossBattle/BossBattleGame.tsx')
  assert(/if \(liveSessionId && myParticipantId\)/.test(bb) && /<BrawlGame /.test(bb), 'Live Classroom still gets the cooperative mode; solo gets the brawler')
}

console.log('\n== 10. Music scores ==')
{
  const names = new Set<string>()
  ;['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'].forEach((n) => {
    for (let o = 1; o <= 6; o++) names.add(`${n}${o}`)
  })
  for (const f of ['components/gameRoomV2/bossBattle/brawl/music.ts', 'components/gameRoomV2/towerDefense/music.ts']) {
    const src = read(f)
    const notes = Array.from(src.matchAll(/\b([A-G][#b]?\d)\b/g)).map((m) => m[1])
    assert(notes.length > 20 && notes.every((n) => names.has(n)), `${f}: every note name is valid (${notes.length} notes)`)
    const bars = Array.from(src.matchAll(/'([A-G#b0-9 .\-]{20,})'/g)).map((m) => m[1].trim().split(/\s+/).length)
    assert(bars.length > 0 && bars.every((n) => n === 16), `${f}: every melody bar is 16 steps`)
  }
  const eng = read('components/gameRoomV2/gameplay/gameMusic.ts')
  assert(/getAudioContext\(\)/.test(eng) && /clearInterval/.test(eng) && /disconnect\(\)/.test(eng), 'the shared engine uses the one AudioContext and cleans up')
  assert(/duck\(showQuestion \|\| userPaused\)/.test(read('components/gameRoomV2/bossBattle/brawl/BrawlGame.tsx')), 'music ducks under questions and pause')
  assert(/startMusic\(\)\s*\n\s*setDifficulty\(d\)/.test(read('components/gameRoomV2/bossBattle/brawl/BrawlGame.tsx')), 'music starts only from the Enter-the-arena click')
}

void CHECKPOINTS
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
