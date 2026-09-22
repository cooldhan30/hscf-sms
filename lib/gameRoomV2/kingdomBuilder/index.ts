export {
  EMPTY_RESOURCES,
  addResources,
  canAfford,
  spendResources,
  resourcesEarnedForAnswer,
  type ResourceKind,
  type ResourceBundle,
} from './resources'
export { BUILD_ORDER, getBuilding, nextBuildingToConstruct, isKingdomComplete, type BuildingId, type BuildingDefinition } from './buildings'
export {
  KINGDOM_BUILDER_DIFFICULTY_SETTINGS,
  getKingdomBuilderDifficultySettings,
  type KingdomBuilderDifficulty,
  type KingdomBuilderDifficultySettings,
} from './difficulty'
export {
  STREAK_UPGRADE_TIERS,
  streakUpgradeTier,
  createInitialKingdom,
  applyCorrectAnswer,
  applyWrongAnswer,
  acknowledgeCompletion,
  kingdomProgressPct,
  kingdomComplete,
  type StreakUpgradeTier,
  type KingdomState,
} from './kingdom'
