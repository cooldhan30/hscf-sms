import { getBoss, phaseIndexForHealthFraction, type BossId, type BossDefinition } from './bosses'
import { getAbility, type AbilityId } from './abilities'
import type { BossBattleDifficultySettings } from './difficulty'

// A single contributing player's state. Deliberately generic (an id +
// a label, not "the student") so the same battle simulation drives 1
// attacker today (solo) and multiple attackers sharing one boss's
// health pool later without a rewrite -- this is the "architecture
// ready for classroom co-op" requirement: damage contribution
// (applyCorrectAnswerDamage/activateAbility) is already keyed by
// attacker id, only the session layer above it is solo-only today (see
// supabase/migrations/076's sms_gamev2_sessions.student_id being a
// single required column -- co-op's live multi-session sync is
// explicitly out of scope for this pass).
export interface AttackerState {
  id: string
  label: string
  isPlayer: boolean
  health: number
  maxHealth: number
  charge: number
  maxCharge: number
  // Active Focus buff, if any -- consumed by the next correct answer's
  // damage calculation.
  focusMultiplier: number | null
  shieldCharges: number
  damageDealt: number
}

export interface BattleState {
  difficulty: BossBattleDifficultySettings['id']
  boss: BossDefinition
  bossHealth: number
  bossMaxHealth: number
  bossPhaseIndex: number
  attackers: AttackerState[]
  elapsedMs: number
  timeSinceCounterattackMs: number
  battleOver: boolean
  victory: boolean
  lastCounterattackTargetId: string | null
}

export const PLAYER_ATTACKER_ID = 'player'
const MAX_CHARGE = 100

export function createInitialBattle(bossId: BossId, settings: BossBattleDifficultySettings): BattleState {
  const boss = getBoss(bossId)
  return {
    difficulty: settings.id,
    boss,
    bossHealth: boss.baseHealth,
    bossMaxHealth: boss.baseHealth,
    bossPhaseIndex: 0,
    attackers: [
      {
        id: PLAYER_ATTACKER_ID,
        label: 'You',
        isPlayer: true,
        health: settings.playerMaxHealth,
        maxHealth: settings.playerMaxHealth,
        charge: 0,
        maxCharge: MAX_CHARGE,
        focusMultiplier: null,
        shieldCharges: 0,
        damageDealt: 0,
      },
    ],
    elapsedMs: 0,
    timeSinceCounterattackMs: 0,
    battleOver: false,
    victory: false,
    lastCounterattackTargetId: null,
  }
}

function currentPhase(state: BattleState) {
  return state.boss.phases[state.bossPhaseIndex]
}

function recomputePhase(state: BattleState): number {
  const fraction = Math.max(0, state.bossHealth / state.bossMaxHealth)
  return phaseIndexForHealthFraction(state.boss, fraction)
}

// A correct answer's damage to the boss, applied by attacker id -- any
// attacker in the array can deal damage this way, which is the concrete
// hook a future co-op session would reuse for every participant's
// answer, not just the solo player's.
export function applyCorrectAnswerDamage(state: BattleState, attackerId: string, settings: BossBattleDifficultySettings): BattleState {
  const attacker = state.attackers.find((a) => a.id === attackerId)
  if (!attacker || state.battleOver) return state

  const multiplier = attacker.focusMultiplier ?? 1
  const damage = Math.round(settings.baseDamagePerCorrectAnswer * multiplier)
  const bossHealth = Math.max(0, state.bossHealth - damage)

  const attackers = state.attackers.map((a) =>
    a.id === attackerId
      ? { ...a, charge: Math.min(a.maxCharge, a.charge + settings.chargePerCorrectAnswer), focusMultiplier: null, damageDealt: a.damageDealt + damage }
      : a
  )

  const nextState: BattleState = { ...state, bossHealth, attackers }
  nextState.bossPhaseIndex = recomputePhase(nextState)
  nextState.victory = bossHealth <= 0
  nextState.battleOver = nextState.victory || state.attackers.every((a) => !a.isPlayer || a.health <= 0)

  return nextState
}

// A wrong answer's consequence: an immediate counterattack against that
// attacker (bypassing the normal counterattack clock) -- a real but
// bounded consequence, not a double penalty on top of losing the damage
// opportunity.
export function applyWrongAnswerConsequence(state: BattleState, attackerId: string, settings: BossBattleDifficultySettings): BattleState {
  if (!settings.wrongAnswerTriggersCounterattack || state.battleOver) return state
  return applyCounterattack(state, attackerId, settings)
}

function applyCounterattack(state: BattleState, targetId: string, settings: BossBattleDifficultySettings): BattleState {
  const target = state.attackers.find((a) => a.id === targetId)
  if (!target || target.health <= 0) return state

  const rawDamage = Math.round(currentPhase(state).counterattackDamage * settings.bossCounterattackMultiplier)

  let attackers: AttackerState[]
  if (target.shieldCharges > 0) {
    attackers = state.attackers.map((a) => (a.id === targetId ? { ...a, shieldCharges: a.shieldCharges - 1 } : a))
  } else {
    attackers = state.attackers.map((a) => (a.id === targetId ? { ...a, health: Math.max(0, a.health - rawDamage) } : a))
  }

  const nextState: BattleState = { ...state, attackers, timeSinceCounterattackMs: 0, lastCounterattackTargetId: targetId }
  nextState.battleOver = nextState.attackers.every((a) => !a.isPlayer || a.health <= 0)
  return nextState
}

// Spends charge on an ability, by attacker id -- same "works for any
// attacker" shape as applyCorrectAnswerDamage, for the same co-op-
// readiness reason.
export function activateAbility(state: BattleState, attackerId: string, abilityId: AbilityId): BattleState {
  const attacker = state.attackers.find((a) => a.id === attackerId)
  if (!attacker || state.battleOver) return state

  const ability = getAbility(abilityId)
  if (attacker.charge < ability.chargeCost) return state

  const bossHealth = Math.max(0, state.bossHealth - ability.bonusDamage)

  const attackers = state.attackers.map((a) =>
    a.id === attackerId
      ? {
          ...a,
          charge: a.charge - ability.chargeCost,
          shieldCharges: a.shieldCharges + ability.shieldCharges,
          focusMultiplier: ability.focusUsesRemaining > 0 ? ability.focusDamageMultiplier : a.focusMultiplier,
          damageDealt: a.damageDealt + ability.bonusDamage,
        }
      : a
  )

  const nextState: BattleState = { ...state, bossHealth, attackers }
  nextState.bossPhaseIndex = recomputePhase(nextState)
  nextState.victory = bossHealth <= 0
  nextState.battleOver = nextState.victory
  return nextState
}

export function canUseAbility(state: BattleState, attackerId: string, abilityId: AbilityId): boolean {
  const attacker = state.attackers.find((a) => a.id === attackerId)
  if (!attacker) return false
  return attacker.charge >= getAbility(abilityId).chargeCost
}

// The battle's own real-time clock: the boss counterattacks on a fixed
// interval determined by its CURRENT phase (a later phase's shorter
// interval is the concrete mechanical weight behind "boss phases", not
// just a cosmetic health-bar segment). Deliberately targets the first
// living player attacker -- a placeholder targeting rule a future
// co-op pass would extend to "pick among living attackers", not
// something this pass needs to solve.
export function tickBattle(state: BattleState, deltaMs: number, settings: BossBattleDifficultySettings): BattleState {
  if (state.battleOver) return state

  const timeSinceCounterattackMs = state.timeSinceCounterattackMs + deltaMs
  const interval = currentPhase(state).counterattackIntervalMs

  let next: BattleState = { ...state, elapsedMs: state.elapsedMs + deltaMs, timeSinceCounterattackMs }

  if (timeSinceCounterattackMs >= interval) {
    const target = next.attackers.find((a) => a.isPlayer && a.health > 0)
    if (target) {
      next = applyCounterattack({ ...next, timeSinceCounterattackMs: 0 }, target.id, settings)
    } else {
      next = { ...next, timeSinceCounterattackMs: 0 }
    }
  }

  return next
}
