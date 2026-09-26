import { mulberry32 } from '../gameplay/rng'

// Solo Boss Battle: a turn-based duel.
//
// Each turn:
//   1. The boss TELEGRAPHS its next move (its "intent").
//   2. The student answers a Tamil question -- a correct answer lands a
//      quick strike and earns ENERGY (fast answers and streaks earn more
//      and can CRIT); a wrong answer gives the boss an opening.
//   3. The student CHOOSES an action to spend energy on (strike, power
//      blow, guard, heal, or save up for the ultimate) -- reading the
//      boss's intent is the strategy: guard a heavy slam, interrupt a
//      charge with a power blow, burst through a shield with the ultimate.
//   4. The boss acts.
// Bosses change patterns across three phases and enrage in the last one.
//
// This is an in-match layer driven by the server's grading of each
// answer; score/XP/achievements are computed server-side at /complete.
// Live Classroom co-op boss fights are separate (coopBattle.ts): there the
// team's damage is derived on the server from validated answers.

export type DuelBossId = 'irul' | 'puyal' | 'malai'
export type IntentKind = 'strike' | 'heavy' | 'flurry' | 'shield' | 'charge'
export type ActionId = 'strike' | 'power' | 'guard' | 'heal' | 'ultimate' | 'rest'
export type DuelDifficulty = 'easy' | 'normal' | 'hard'

export interface DuelBoss {
  id: DuelBossId
  name: string
  tamilName: string
  title: string
  color: string
  accent: string
  hpPerQuestion: number
  // Move rotation per phase (cycled, with the RNG occasionally swapping).
  patterns: [IntentKind[], IntentKind[], IntentKind[]]
  phaseNames: [string, string, string]
}

export const DUEL_BOSSES: DuelBoss[] = [
  {
    id: 'irul',
    name: 'Irul King',
    tamilName: 'இருள் அரசன்',
    title: 'Lord of the long night',
    color: '#6d28d9',
    accent: '#c4b5fd',
    hpPerQuestion: 16,
    patterns: [
      ['strike', 'strike', 'charge', 'heavy'],
      ['strike', 'shield', 'flurry', 'charge', 'heavy'],
      ['flurry', 'charge', 'heavy', 'strike'],
    ],
    phaseNames: ['Shadow Rising', 'Night Veil', 'Endless Dark'],
  },
  {
    id: 'puyal',
    name: 'Puyal',
    tamilName: 'புயல்',
    title: 'The storm beast',
    color: '#0369a1',
    accent: '#7dd3fc',
    hpPerQuestion: 14,
    patterns: [
      ['flurry', 'strike', 'flurry', 'charge', 'heavy'],
      ['flurry', 'flurry', 'shield', 'charge', 'heavy'],
      ['flurry', 'charge', 'heavy', 'flurry'],
    ],
    phaseNames: ['Gathering Wind', 'Thunderhead', 'Eye of the Storm'],
  },
  {
    id: 'malai',
    name: 'Malai',
    tamilName: 'மலை',
    title: 'The stone giant',
    color: '#78716c',
    accent: '#e7e5e4',
    hpPerQuestion: 18,
    patterns: [
      ['shield', 'strike', 'charge', 'heavy'],
      ['strike', 'shield', 'charge', 'heavy', 'strike'],
      ['charge', 'heavy', 'shield', 'charge', 'heavy'],
    ],
    phaseNames: ['Awakening', 'Landslide', 'Mountain Wrath'],
  },
]

export const ACTIONS: { id: ActionId; name: string; tamilName: string; cost: number; description: string }[] = [
  { id: 'strike', name: 'Strike', tamilName: 'தாக்கு', cost: 2, description: '18 damage.' },
  { id: 'power', name: 'Power Blow', tamilName: 'பலத்த அடி', cost: 4, description: '40 damage. Interrupts a charging boss (cancels its heavy attack).' },
  { id: 'guard', name: 'Guard', tamilName: 'காவல்', cost: 1, description: 'Block 70% of the boss’s attack this turn.' },
  { id: 'heal', name: 'Heal', tamilName: 'மருந்து', cost: 3, description: 'Restore 22 health.' },
  { id: 'ultimate', name: 'Tamil Fire', tamilName: 'தமிழ்த் தீ', cost: 8, description: '90 damage that burns straight through shields.' },
  { id: 'rest', name: 'Save energy', tamilName: 'காத்திரு', cost: 0, description: 'Do nothing now; keep your energy for later.' },
]

export const MAX_ENERGY = 10
export const STRIKE_DAMAGE = 18
export const POWER_DAMAGE = 40
export const ULTIMATE_DAMAGE = 90
export const HEAL_AMOUNT = 22
export const GUARD_REDUCTION = 0.7
export const QUICK_STRIKE = 6
export const SHIELD_AMOUNT = 30

const INTENT_DAMAGE: Record<IntentKind, number> = { strike: 10, heavy: 26, flurry: 7, shield: 0, charge: 0 }
const DIFF: Record<DuelDifficulty, { playerHp: number; bossHp: number; bossDmg: number }> = {
  easy: { playerHp: 120, bossHp: 0.62, bossDmg: 0.7 },
  normal: { playerHp: 100, bossHp: 1, bossDmg: 1 },
  hard: { playerHp: 90, bossHp: 1.3, bossDmg: 1.3 },
}

export type DuelStep = 'question' | 'action' | 'over'

export type DuelEvent =
  | { type: 'quickStrike'; damage: number; crit: boolean }
  | { type: 'miss' }
  | { type: 'playerAction'; action: ActionId; damage: number; heal: number; interrupted: boolean; shieldAbsorbed: number }
  | { type: 'bossAttack'; intent: IntentKind; damage: number; blocked: number; hits: number }
  | { type: 'bossShield'; amount: number }
  | { type: 'bossCharge' }
  | { type: 'phase'; index: number; name: string }
  | { type: 'revive' }
  | { type: 'victory' }
  | { type: 'defeat' }
  | { type: 'escaped' }

export interface DuelState {
  boss: DuelBoss
  difficulty: DuelDifficulty
  bossHp: number
  bossMaxHp: number
  bossShield: number
  phase: number
  patternCursor: number
  intent: IntentKind
  charging: boolean
  playerHp: number
  playerMaxHp: number
  energy: number
  streak: number
  opening: boolean // a wrong answer this turn -> boss hits harder
  turn: number
  totalTurns: number
  step: DuelStep
  outcome: 'victory' | 'defeat' | 'escaped' | null
  // Defeated early (with 30%+ of the questions left), the boss rises once
  // more in an enraged final form sized to the remaining turns -- so a
  // fast, accurate student keeps battling instead of idling out the set.
  revived: boolean
  finalFormDefeated: boolean
  rand: () => number
  stats: { damageDealt: number; crits: number; interrupts: number; blocked: number; heals: number; ultimates: number; bestStreak: number }
}

export function getDuelBoss(id: DuelBossId): DuelBoss {
  return DUEL_BOSSES.find((b) => b.id === id) ?? DUEL_BOSSES[0]
}

export function createDuel(opts: { seed: number; bossId: DuelBossId; difficulty: DuelDifficulty; totalQuestions: number }): DuelState {
  const boss = getDuelBoss(opts.bossId)
  const d = DIFF[opts.difficulty]
  const bossMaxHp = Math.round(boss.hpPerQuestion * Math.max(6, opts.totalQuestions) * d.bossHp)
  const state: DuelState = {
    boss,
    difficulty: opts.difficulty,
    bossHp: bossMaxHp,
    bossMaxHp,
    bossShield: 0,
    phase: 0,
    patternCursor: 0,
    intent: boss.patterns[0][0],
    charging: false,
    playerHp: d.playerHp,
    playerMaxHp: d.playerHp,
    energy: 2,
    streak: 0,
    opening: false,
    turn: 1,
    totalTurns: opts.totalQuestions,
    step: 'question',
    outcome: null,
    revived: false,
    finalFormDefeated: false,
    rand: mulberry32(opts.seed),
    stats: { damageDealt: 0, crits: 0, interrupts: 0, blocked: 0, heals: 0, ultimates: 0, bestStreak: 0 },
  }
  return state
}

export function intentDamage(state: DuelState, intent: IntentKind = state.intent): number {
  const d = DIFF[state.difficulty]
  const enrage = state.phase === 2 ? 1.3 : state.phase === 1 ? 1.12 : 1
  return Math.round(INTENT_DAMAGE[intent] * d.bossDmg * enrage)
}

function dealToBoss(state: DuelState, raw: number, pierce: boolean): { dealt: number; absorbed: number } {
  let dmg = raw
  let absorbed = 0
  if (!pierce && state.bossShield > 0) {
    absorbed = Math.min(state.bossShield, dmg)
    state.bossShield -= absorbed
    dmg -= absorbed
  }
  const dealt = Math.min(dmg, state.bossHp)
  state.bossHp -= dealt
  state.stats.damageDealt += dealt
  return { dealt, absorbed }
}

function checkPhase(state: DuelState, events: DuelEvent[]) {
  if (state.revived) return
  const f = state.bossHp / state.bossMaxHp
  const next = f <= 1 / 3 ? 2 : f <= 2 / 3 ? 1 : 0
  if (next > state.phase) {
    state.phase = next
    state.patternCursor = 0
    state.charging = false
    state.intent = state.boss.patterns[next][0]
    events.push({ type: 'phase', index: next, name: state.boss.phaseNames[next] })
  }
}

function checkEnd(state: DuelState, events: DuelEvent[]): boolean {
  if (state.bossHp <= 0) {
    const turnsLeft = state.totalTurns - state.turn
    if (!state.revived && turnsLeft >= Math.ceil(state.totalTurns * 0.3)) {
      state.revived = true
      state.bossMaxHp = Math.round(state.boss.hpPerQuestion * turnsLeft * 0.8 * DIFF[state.difficulty].bossHp)
      state.bossHp = state.bossMaxHp
      state.bossShield = 0
      state.phase = 2
      state.patternCursor = 0
      state.charging = false
      state.intent = state.boss.patterns[2][0]
      events.push({ type: 'revive' })
      return false
    }
    if (state.revived) state.finalFormDefeated = true
    state.step = 'over'
    state.outcome = 'victory'
    events.push({ type: 'victory' })
    return true
  }
  if (state.playerHp <= 0) {
    state.step = 'over'
    state.outcome = 'defeat'
    events.push({ type: 'defeat' })
    return true
  }
  return false
}

// Step 2: the graded answer.
export function resolveAnswer(state: DuelState, result: { correct: boolean; points: number }, events: DuelEvent[] = []) {
  if (state.step !== 'question') return
  if (result.correct) {
    state.streak++
    state.stats.bestStreak = Math.max(state.stats.bestStreak, state.streak)
    const fast = result.points >= 1300
    const crit = fast && state.streak >= 3
    const raw = Math.round(QUICK_STRIKE * (1 + Math.min(5, state.streak - 1) * 0.15) * (crit ? 1.8 : 1))
    const { dealt } = dealToBoss(state, raw, false)
    if (crit) state.stats.crits++
    state.energy = Math.min(MAX_ENERGY, state.energy + 2 + (fast ? 1 : 0))
    events.push({ type: 'quickStrike', damage: dealt, crit })
    checkPhase(state, events)
    if (checkEnd(state, events)) return
  } else {
    state.streak = 0
    state.opening = true
    events.push({ type: 'miss' })
  }
  state.step = 'action'
}

export function canAct(state: DuelState, action: ActionId): boolean {
  if (state.step !== 'action') return false
  const def = ACTIONS.find((a) => a.id === action)!
  if (state.energy < def.cost) return false
  if (action === 'heal' && state.playerHp >= state.playerMaxHp) return false
  return true
}

function nextIntent(state: DuelState) {
  const pattern = state.boss.patterns[state.phase]
  state.patternCursor = (state.patternCursor + 1) % pattern.length
  let next = pattern[state.patternCursor]
  // Occasional variation keeps runs from being identical (never removes
  // the telegraph: the player always sees the intent before answering).
  if (next === 'strike' && state.rand() < 0.3) next = 'flurry'
  state.intent = next
}

// Step 3 + 4: the player's action, then the boss's move.
export function takeAction(state: DuelState, action: ActionId, events: DuelEvent[] = []) {
  if (!canAct(state, action)) return
  const def = ACTIONS.find((a) => a.id === action)!
  state.energy -= def.cost
  let damage = 0
  let heal = 0
  let interrupted = false
  let absorbed = 0
  let guard = false
  if (action === 'strike') ({ dealt: damage, absorbed } = dealToBoss(state, STRIKE_DAMAGE, false))
  if (action === 'power') {
    ;({ dealt: damage, absorbed } = dealToBoss(state, POWER_DAMAGE, false))
    if (state.intent === 'heavy' && state.charging) {
      interrupted = true
      state.stats.interrupts++
    }
  }
  if (action === 'ultimate') {
    ;({ dealt: damage } = dealToBoss(state, ULTIMATE_DAMAGE, true))
    state.bossShield = 0
    state.stats.ultimates++
  }
  if (action === 'heal') {
    heal = Math.min(HEAL_AMOUNT, state.playerMaxHp - state.playerHp)
    state.playerHp += heal
    state.stats.heals++
  }
  if (action === 'guard') guard = true
  events.push({ type: 'playerAction', action, damage, heal, interrupted, shieldAbsorbed: absorbed })
  checkPhase(state, events)
  if (checkEnd(state, events)) return

  // Boss move.
  const intent = state.intent
  if (intent === 'charge') {
    state.charging = true
    events.push({ type: 'bossCharge' })
  } else if (intent === 'shield') {
    state.bossShield += SHIELD_AMOUNT
    events.push({ type: 'bossShield', amount: SHIELD_AMOUNT })
  } else if (intent === 'heavy' && interrupted) {
    events.push({ type: 'bossAttack', intent, damage: 0, blocked: 0, hits: 0 })
    state.charging = false
  } else {
    const hits = intent === 'flurry' ? 2 : 1
    let total = 0
    let blocked = 0
    for (let h = 0; h < hits; h++) {
      let dmg = intentDamage(state, intent)
      if (state.opening) dmg = Math.round(dmg * 1.25)
      if (guard) {
        const b = Math.round(dmg * GUARD_REDUCTION)
        blocked += b
        dmg -= b
      }
      total += dmg
    }
    state.playerHp = Math.max(0, state.playerHp - total)
    state.stats.blocked += blocked
    if (intent === 'heavy') state.charging = false
    events.push({ type: 'bossAttack', intent, damage: total, blocked, hits })
  }
  state.opening = false
  if (checkEnd(state, events)) return
  nextIntent(state)

  // Next turn (or the boss escapes when the questions run out).
  if (state.turn >= state.totalTurns) {
    state.step = 'over'
    // The first form was already beaten: surviving its final form still wins.
    state.outcome = state.revived ? 'victory' : 'escaped'
    events.push({ type: state.revived ? 'victory' : 'escaped' })
    return
  }
  state.turn++
  state.step = 'question'
}
