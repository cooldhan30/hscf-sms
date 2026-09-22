export { MANSION_ROOMS, ROOM_COUNT, getRoom, type RoomId, type RoomDefinition } from './rooms'
export { MYSTERY_TEMPLATES, getMysteryTemplate, type MysteryTemplate } from './templates'
export { generateMystery, buildResolutionText, type GeneratedMystery } from './generator'
export {
  MYSTERY_MANSION_DIFFICULTY_SETTINGS,
  getMysteryMansionDifficultySettings,
  type MysteryMansionDifficulty,
  type MysteryMansionDifficultySettings,
} from './difficulty'
export {
  createInitialInvestigation,
  currentRoom,
  cluesFound,
  applyCorrectAnswer,
  applyWrongAnswer,
  investigationProgressPct,
  type InvestigationState,
} from './investigation'
