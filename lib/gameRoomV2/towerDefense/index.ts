export { TOWER_TYPES, getTowerType, upgradedStats, type TowerType, type TowerTypeId } from './towers'
export { DIFFICULTY_SETTINGS, getDifficultySettings, type DifficultySettings, type TowerDefenseDifficulty } from './difficulty'
export { PATH_WAYPOINTS, pathLength, positionAtDistance, ENEMY_DEFINITIONS, waveComposition, scaledEnemyStats, type EnemyDefinition } from './waves'
export {
  TOWER_PADS,
  createInitialBattlefield,
  startWave,
  canAffordTower,
  placeTower,
  upgradeTower,
  applyWrongAnswerConsequence,
  applyCorrectAnswerReward,
  tickBattlefield,
  advanceToNextWave,
  type BattlefieldState,
  type EnemyState,
  type PlacedTower,
  type ImpactEvent,
  type TickResult,
} from './simulation'
