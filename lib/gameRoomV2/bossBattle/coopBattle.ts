import { getBoss, phaseIndexForHealthFraction, type BossId, type BossDefinition } from './bosses'
import type { BossBattleDifficultySettings } from './difficulty'

// Cooperative (Live Classroom) Boss Battle -- a GENUINELY different
// mechanic from solo, not just a multiplayer wrapper around it: the
// class shares ONE boss health pool, and there is deliberately NO
// individual player health, NO boss counterattack, and NO defeat
// state. A wrong answer has no damage/visible consequence at all --
// only "no damage was dealt this turn" -- so there is nothing that
// could read as public humiliation or naming/shaming, and a student
// can always recover fully on the very next question. The battle's
// only two outcomes are victory (the class reduces the boss to 0 HP)
// or the live session ending before that happens (a neutral summary,
// never framed as anyone's loss or blame).
//
// Server-authoritative by construction, same architecture as
// lib/gameRoomV2/racing/race.ts's replayRacerFromAnswers: boss HP is
// never written by a client. It's derived, read-only, from the sum of
// every participant's ALREADY-persisted correct answers (fixed damage
// per correct answer -- no timing/effect decay to replay here, unlike
// Racing's speed boosts, since Boss Battle's cooperative damage has no
// time-based component at all -- so this is actually simpler than
// Racing's replay).

export interface CoopContribution {
  participantId: string
  nickname: string
  correctCount: number
  currentStreak: number
  bestStreak: number
  damageDealt: number
}

export interface CoopBattleState {
  boss: BossDefinition
  bossHealth: number
  bossMaxHealth: number
  bossPhaseIndex: number
  victory: boolean
  totalDamageDealt: number
  contributions: CoopContribution[]
}

// Streak-triggered team attacks: reaching STREAK_TEAM_ATTACK_THRESHOLD
// correct answers in a row grants a one-time bonus damage burst,
// attributed to whichever participant's streak crossed the threshold
// -- a celebratory, PUBLIC-but-never-negative moment (the exact
// "visually exciting team attacks" the spec asks streaks to trigger),
// never a penalty. Re-triggers every time the streak crosses another
// multiple of the threshold (6, 12, 18, ...), so a long streak keeps
// paying off rather than only rewarding the first milestone.
export const STREAK_TEAM_ATTACK_THRESHOLD = 6
export const STREAK_TEAM_ATTACK_BONUS_DAMAGE = 25

export function streakTeamAttacksTriggered(streak: number): number {
  return Math.floor(streak / STREAK_TEAM_ATTACK_THRESHOLD)
}

function recomputePhase(boss: BossDefinition, bossHealth: number, bossMaxHealth: number): number {
  const fraction = Math.max(0, bossHealth / bossMaxHealth)
  return phaseIndexForHealthFraction(boss, fraction)
}

export interface ParticipantAnswerSummary {
  participantId: string
  nickname: string
  correctCount: number
  currentStreak: number
  bestStreak: number
}

// Builds the shared battle state from every participant's own,
// already-server-persisted correct-answer count (sms_gamev2_sessions
// .correct_count) and streak fields -- the exact same data
// results/route.ts's leaderboard already trusts for every other
// engine. Total damage = sum of (correctCount * baseDamagePerCorrectAnswer)
// across every participant, PLUS every streak-team-attack bonus any
// participant's streak has triggered along the way -- both purely
// additive and order-independent, so this never needs each
// participant's individual answer TIMESTAMPS the way Racing's replay
// does (cooperative damage has no time-based decay to reconstruct).
export function buildCoopBattleState(
  bossId: BossId,
  settings: BossBattleDifficultySettings,
  participants: ParticipantAnswerSummary[]
): CoopBattleState {
  const boss = getBoss(bossId)
  const bossMaxHealth = boss.baseHealth

  const contributions: CoopContribution[] = participants.map((p) => {
    const baseDamage = p.correctCount * settings.baseDamagePerCorrectAnswer
    const teamAttackDamage = streakTeamAttacksTriggered(p.bestStreak) * STREAK_TEAM_ATTACK_BONUS_DAMAGE
    return {
      participantId: p.participantId,
      nickname: p.nickname,
      correctCount: p.correctCount,
      currentStreak: p.currentStreak,
      bestStreak: p.bestStreak,
      damageDealt: baseDamage + teamAttackDamage,
    }
  })

  const totalDamageDealt = contributions.reduce((sum, c) => sum + c.damageDealt, 0)
  const bossHealth = Math.max(0, bossMaxHealth - totalDamageDealt)
  const victory = bossHealth <= 0

  return {
    boss,
    bossHealth,
    bossMaxHealth,
    bossPhaseIndex: recomputePhase(boss, bossHealth, bossMaxHealth),
    victory,
    totalDamageDealt,
    contributions,
  }
}

// Class-wide progress toward defeating the boss, as a percentage --
// the "class progress" the teacher's overview and each student's own
// "team progress" both display.
export function coopProgressPct(state: CoopBattleState): number {
  return Math.min(100, Math.round((state.totalDamageDealt / state.bossMaxHealth) * 100))
}

// Ranks contributions for the "appropriate leaderboard/statistics" the
// spec calls for -- by damage dealt (the direct, positive measure of
// contribution), descending. Deliberately never ranks by "questions
// missed" or anything that could read as a mistake tally -- only
// positive contribution is ever ranked or surfaced.
export function rankCoopContributions(contributions: CoopContribution[]): CoopContribution[] {
  return [...contributions].sort((a, b) => b.damageDealt - a.damageDealt)
}

export type CoopSessionStatus = 'CREATED' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'

// Whether the cooperative battle has concluded for THIS participant's
// own view -- true once EITHER the class defeats the boss (server-
// computed, the same for every viewer) OR this participant's own
// sms_gamev2_sessions row leaves ACTIVE/PAUSED for any reason.
// Extracted as a pure function (backing BossBattleGame.tsx's
// CoopBossBattleGame) specifically because this exact branch was the
// site of a real bug caught during development: the live session
// ending (sms_gamev2_end_live_session, migration 080) marks every
// still-in-progress participant session ABANDONED, never COMPLETED --
// an ABANDONED session never triggers useGameSessionState's own
// /complete call, so a check that only watched for a populated
// `result` (which only ever arrives via /complete) would leave a
// student who was mid-battle when the teacher clicked "End" stuck on
// an infinite loading screen, with no path to ever seeing a results
// summary. This function's own truth table is what
// scripts/verify-gameroom-v2-boss-battle-multiplayer.ts directly
// exercises to guard against that regression.
export function isCoopBattleConcluded(victory: boolean, sessionStatus: CoopSessionStatus): boolean {
  return victory || sessionStatus === 'COMPLETED' || sessionStatus === 'ABANDONED'
}
