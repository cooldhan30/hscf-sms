// Solo Boss Battle (turn-based duel) mechanics + balance, driven headlessly
// against lib/gameRoomV2/bossBattle/duel.ts: damage, energy, crits, guard,
// interrupts, shields, heal, ultimate, phase transitions + enrage, victory,
// defeat, "boss escapes", and balance for different kinds of players.
//
//   npx tsx scripts/verify-gameroom-v2-boss-duel.ts
import {
  createDuel,
  resolveAnswer,
  takeAction,
  canAct,
  intentDamage,
  DUEL_BOSSES,
  STRIKE_DAMAGE,
  POWER_DAMAGE,
  ULTIMATE_DAMAGE,
  GUARD_REDUCTION,
  SHIELD_AMOUNT,
  type DuelState,
  type DuelEvent,
  type ActionId,
  type DuelDifficulty,
  type DuelBossId,
} from '../lib/gameRoomV2/bossBattle/duel'
import { mulberry32 } from '../lib/gameRoomV2/gameplay/rng'

let failures = 0
let passes = 0
function assert(cond: unknown, msg: string) {
  if (cond) passes++
  else {
    failures++
    console.error(`  FAIL: ${msg}`)
  }
}
const ok = { correct: true, points: 1100 }
const fast = { correct: true, points: 1450 }
const wrong = { correct: false, points: 0 }

console.log('== Turn structure, energy, quick strikes ==')
{
  const s = createDuel({ seed: 1, bossId: 'irul', difficulty: 'normal', totalQuestions: 15 })
  assert(s.step === 'question' && s.turn === 1 && s.intent, 'turn 1 starts with a telegraphed boss intent and a question')
  assert(!canAct(s, 'strike'), 'no actions before answering')
  const hp0 = s.bossHp
  const e0 = s.energy
  const ev: DuelEvent[] = []
  resolveAnswer(s, ok, ev)
  assert(s.bossHp < hp0 && ev.some((e) => e.type === 'quickStrike'), 'a correct answer lands a quick strike')
  assert(s.energy === e0 + 2 && s.step === 'action', 'and earns 2 energy, then it is time to act')
  const s2 = createDuel({ seed: 1, bossId: 'irul', difficulty: 'normal', totalQuestions: 15 })
  resolveAnswer(s2, fast)
  assert(s2.energy === 2 + 3, 'a fast answer earns +1 energy')
  const s3 = createDuel({ seed: 1, bossId: 'irul', difficulty: 'normal', totalQuestions: 15 })
  const ev3: DuelEvent[] = []
  resolveAnswer(s3, wrong, ev3)
  assert(s3.energy === 2 && s3.opening && ev3.some((e) => e.type === 'miss'), 'a wrong answer earns nothing and gives the boss an opening')
}

console.log('\n== Crits on streaks ==')
{
  const s = createDuel({ seed: 2, bossId: 'irul', difficulty: 'normal', totalQuestions: 30 })
  let crit = false
  for (let i = 0; i < 4 && !crit; i++) {
    const ev: DuelEvent[] = []
    resolveAnswer(s, fast, ev)
    crit = ev.some((e) => e.type === 'quickStrike' && e.crit)
    takeAction(s, 'rest')
  }
  assert(crit && s.stats.crits >= 1, 'three fast correct answers in a row -> critical strike')
}

console.log('\n== Actions ==')
{
  const s = createDuel({ seed: 3, bossId: 'irul', difficulty: 'normal', totalQuestions: 20 })
  resolveAnswer(s, ok)
  const hp = s.bossHp
  takeAction(s, 'strike')
  assert(hp - s.bossHp === STRIKE_DAMAGE, 'Strike deals its damage')
  // Guard reduces the boss attack.
  const g = createDuel({ seed: 4, bossId: 'irul', difficulty: 'normal', totalQuestions: 20 })
  g.intent = 'strike'
  resolveAnswer(g, ok)
  const ev: DuelEvent[] = []
  const php = g.playerHp
  takeAction(g, 'guard', ev)
  const atk = ev.find((e) => e.type === 'bossAttack') as { damage: number; blocked: number }
  assert(atk.blocked === Math.round(intentDamage(g, 'strike') * GUARD_REDUCTION) && php - g.playerHp === atk.damage, 'Guard blocks 70% of the hit')
  // Power Blow interrupts a charged heavy attack.
  const p = createDuel({ seed: 5, bossId: 'irul', difficulty: 'normal', totalQuestions: 20 })
  p.intent = 'heavy'
  p.charging = true
  p.energy = 4
  resolveAnswer(p, ok)
  const evp: DuelEvent[] = []
  const hpBefore = p.playerHp
  takeAction(p, 'power', evp)
  const pa = evp.find((e) => e.type === 'playerAction') as { interrupted: boolean; damage: number }
  assert(pa.interrupted && pa.damage === POWER_DAMAGE && p.playerHp === hpBefore, 'Power Blow interrupts a charging heavy attack (no damage taken)')
  // Shield absorbs strikes but not the ultimate.
  const sh = createDuel({ seed: 6, bossId: 'malai', difficulty: 'normal', totalQuestions: 20 })
  sh.bossShield = SHIELD_AMOUNT
  resolveAnswer(sh, wrong)
  sh.energy = 10
  const before = sh.bossHp
  takeAction(sh, 'strike')
  assert(sh.bossHp === before, 'a shield soaks up a strike')
  const u = createDuel({ seed: 6, bossId: 'malai', difficulty: 'normal', totalQuestions: 20 })
  u.bossShield = SHIELD_AMOUNT
  u.energy = 10
  resolveAnswer(u, wrong)
  const b2 = u.bossHp
  takeAction(u, 'ultimate')
  assert(b2 - u.bossHp === ULTIMATE_DAMAGE && u.bossShield >= 0, 'Tamil Fire burns straight through shields')
  // Heal and energy costs.
  const h = createDuel({ seed: 7, bossId: 'irul', difficulty: 'normal', totalQuestions: 20 })
  h.playerHp = 40
  h.energy = 3
  resolveAnswer(h, wrong)
  assert(!canAct(h, 'ultimate') && canAct(h, 'heal'), 'actions cost energy')
  h.intent = 'shield'
  takeAction(h, 'heal')
  assert(h.playerHp === 62, 'Heal restores 22')
}

console.log('\n== Phases, enrage, outcomes ==')
{
  const s = createDuel({ seed: 8, bossId: 'puyal', difficulty: 'normal', totalQuestions: 40 })
  const phases: number[] = []
  let guard = 0
  while (s.step !== 'over' && guard++ < 200) {
    const ev: DuelEvent[] = []
    resolveAnswer(s, fast, ev)
    if (s.step === 'action') {
      const pick: ActionId =
        s.intent === 'heavy' && s.charging && canAct(s, 'power') ? 'power' : s.playerHp < 45 && canAct(s, 'heal') ? 'heal' : canAct(s, 'ultimate') ? 'ultimate' : canAct(s, 'strike') ? 'strike' : 'rest'
      takeAction(s, pick, ev)
    }
    ev.forEach((e) => e.type === 'phase' && phases.push(e.index))
  }
  assert(phases.join() === '1,2', `boss moves through phase 2 and the final phase (${phases.join()})`)
  assert(intentDamage({ ...s, phase: 2 } as DuelState, 'heavy') > intentDamage({ ...s, phase: 0 } as DuelState, 'heavy'), 'final phase enrages (hits harder)')
  assert(s.outcome === 'victory', 'bringing the boss to 0 -> victory')

  const d = createDuel({ seed: 9, bossId: 'irul', difficulty: 'hard', totalQuestions: 40 })
  while (d.step !== 'over') {
    resolveAnswer(d, wrong)
    if (d.step === 'action') takeAction(d, 'rest')
  }
  assert(d.outcome === 'defeat' && d.playerHp === 0, 'health 0 -> defeat')

  const e = createDuel({ seed: 10, bossId: 'malai', difficulty: 'easy', totalQuestions: 6 })
  while (e.step !== 'over') {
    resolveAnswer(e, ok)
    if (e.step === 'action') takeAction(e, e.intent === 'heavy' ? 'guard' : 'rest')
  }
  assert(e.outcome === 'escaped' && e.turn === 6, 'questions run out with the boss standing -> it escapes (not a win)')
}

console.log('\n== Final form ==')
{
  const s = createDuel({ seed: 12, bossId: 'irul', difficulty: 'normal', totalQuestions: 15 })
  s.bossHp = 5
  const ev: DuelEvent[] = []
  resolveAnswer(s, ok, ev)
  assert(ev.some((e) => e.type === 'revive') && s.revived && s.bossHp === s.bossMaxHp && s.phase === 2 && s.step === 'action', 'beaten early, the boss rises again in an enraged final form')
  const late = createDuel({ seed: 13, bossId: 'irul', difficulty: 'normal', totalQuestions: 15 })
  late.turn = 13
  late.bossHp = 5
  const ev2: DuelEvent[] = []
  resolveAnswer(late, ok, ev2)
  assert(late.outcome === 'victory' && !ev2.some((e) => e.type === 'revive'), 'beaten late -> straight victory (no revive)')
  s.turn = 15
  s.intent = 'shield'
  takeAction(s, 'rest')
  assert(s.outcome === 'victory' && !s.finalFormDefeated, 'running out of questions during the final form is still a victory')
}

console.log('\n== Balance (seeded fights) ==')
type Policy = 'smart' | 'reckless' | 'passive'
function fight(seed: number, bossId: DuelBossId, difficulty: DuelDifficulty, accuracy: number, policy: Policy) {
  const s = createDuel({ seed, bossId, difficulty, totalQuestions: 15 })
  const rand = mulberry32(seed ^ 0xb055)
  while (s.step !== 'over') {
    const correct = rand() < accuracy
    resolveAnswer(s, { correct, points: correct ? 1100 + Math.floor(rand() * 400) : 0 })
    if (s.step !== 'action') continue
    let a: ActionId = 'rest'
    if (policy === 'smart') {
      if (s.intent === 'heavy' && s.charging && canAct(s, 'power')) a = 'power'
      else if ((s.intent === 'heavy' || s.intent === 'flurry') && canAct(s, 'guard') && s.playerHp < 60) a = 'guard'
      else if (s.playerHp < 40 && canAct(s, 'heal')) a = 'heal'
      else if (canAct(s, 'ultimate')) a = 'ultimate'
      else if (canAct(s, 'strike') && s.energy >= 5) a = 'strike'
    } else if (policy === 'reckless') {
      a = canAct(s, 'strike') ? 'strike' : 'rest'
    }
    takeAction(s, a)
  }
  return { outcome: s.outcome, turn: s.turn, total: s.totalTurns }
}
const SEEDS = Array.from({ length: 60 }, (_, i) => 500 + i * 71)
let lengthShare = 0
function rate(d: DuelDifficulty, acc: number, p: Policy) {
  let wins = 0
  let n = 0
  let winTurns = 0
  for (const boss of DUEL_BOSSES) for (const seed of SEEDS) {
    n++
    const f = fight(seed, boss.id, d, acc, p)
    if (f.outcome === 'victory') {
      wins++
      winTurns += f.turn / f.total
    }
  }
  if (d === 'normal' && acc === 0.85 && p === 'smart') lengthShare = winTurns / Math.max(1, wins)
  return wins / n
}
const r = {
  easyLearner: rate('easy', 0.6, 'smart'),
  normalGood: rate('normal', 0.85, 'smart'),
  normalReckless: rate('normal', 0.85, 'reckless'),
  normalWeak: rate('normal', 0.5, 'smart'),
  normalPassive: rate('normal', 0.85, 'passive'),
  hardGood: rate('hard', 0.9, 'smart'),
}
for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(16)} win ${(v * 100).toFixed(0)}%`)
assert(r.easyLearner >= 0.7, 'easy: a learner usually wins')
assert(r.normalGood >= 0.7, 'normal: good answers + good decisions usually win')
assert(r.normalReckless < r.normalGood, 'strategy matters: reading the boss beats button-mashing')
assert(r.normalWeak < r.normalGood, 'more correct answers -> more wins')
assert(r.normalPassive < 0.1, 'doing nothing with your energy loses')
assert(r.hardGood >= 0.3 && r.hardGood < 0.97, 'hard: a real challenge')
console.log(`  a won fight uses ${(lengthShare * 100).toFixed(0)}% of the question budget on average`)
assert(lengthShare >= 0.7, 'the fight lasts most of the questions (learning stays woven into the battle)')

console.log(`\n${passes} checks passed, ${failures} failed.`)
if (failures > 0) process.exit(1)
console.log('All Boss Duel checks passed.')
