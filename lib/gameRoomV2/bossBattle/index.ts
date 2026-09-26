export { BOSSES, getBoss, phaseIndexForHealthFraction, type BossId, type BossDefinition, type BossPhaseDefinition } from './bosses'
export { ABILITIES, getAbility, type AbilityId, type AbilityDefinition } from './abilities'
export { BOSS_BATTLE_DIFFICULTY_SETTINGS, getBossBattleDifficultySettings, type BossBattleDifficulty, type BossBattleDifficultySettings } from './difficulty'
export {
  PLAYER_ATTACKER_ID,
  createInitialBattle,
  applyCorrectAnswerDamage,
  applyWrongAnswerConsequence,
  activateAbility,
  canUseAbility,
  tickBattle,
  type AttackerState,
  type BattleState,
} from './battle'
export {
  STREAK_TEAM_ATTACK_THRESHOLD,
  STREAK_TEAM_ATTACK_BONUS_DAMAGE,
  streakTeamAttacksTriggered,
  buildCoopBattleState,
  coopProgressPct,
  rankCoopContributions,
  isCoopBattleConcluded,
  type CoopContribution,
  type CoopBattleState,
  type ParticipantAnswerSummary,
  type CoopSessionStatus,
} from './coopBattle'
export * from './duel'
