import type { GameRoomQuestionType } from './questionTypes'

// Statuses a registered engine can be in -- lets an engine exist in the
// registry (so it's visible for planning/UI mockups) long before it's
// actually playable, and lets a shipped engine be pulled without
// deleting it. DISABLED intentionally sits after ACTIVE, not before
// ALPHA -- it's a distinct "was live, turned off" state, not a synonym
// for COMING_SOON.
export const GAME_ENGINE_STATUSES = ['COMING_SOON', 'ALPHA', 'BETA', 'ACTIVE', 'DISABLED'] as const
export type GameEngineStatus = (typeof GAME_ENGINE_STATUSES)[number]

// Declares which question shapes an engine knows how to render/play.
// A GameRoomQuestionSet is only playable through an engine if every
// question in the set has a type present in supportedQuestionTypes --
// this is the actual mechanism behind "a Question Set may later be
// played through multiple compatible game engines": compatibility is
// computed from these two declarations, never hardcoded per pair.
export interface GameEngineCompatibility {
  supportedQuestionTypes: GameRoomQuestionType[]
  soloSupport: boolean
  multiplayerSupport: boolean
  liveClassroomSupport: boolean
  homeworkSupport: boolean
  minPlayers: number
  maxPlayers: number
}

// The GAMEPLAY half of the content/gameplay split. An engine is a
// self-contained way of PLAYING a compatible GameRoomQuestionSet -- it
// must never embed lesson-specific questions itself (that's the exact
// coupling legacy GameRoom's modules have, see
// lib/gameRoom/gameModule.ts's GameModule.getQuestionBank(), which V2
// is explicitly designed not to repeat). An engine's job is purely:
// given a question set that satisfies its `compatibility`, render and
// score a play session for it.
export interface GameEngine {
  // Stable, unique across the V2 registry -- persisted on session rows
  // once sessions exist (not yet, per migration 073's scope note).
  id: string
  name: string
  tamilName: string | null
  description: string
  // Path under public/ or a Storage URL -- rendering is a UI concern,
  // this interface only carries the reference.
  icon: string | null
  thumbnail: string | null
  compatibility: GameEngineCompatibility
  recommendedLevel: string | null
  // Rough, human-facing estimate (e.g. "5-10 min"), not a scheduling
  // constraint enforced anywhere.
  estimatedDurationMinutes: number | null
  status: GameEngineStatus
  // Semver-ish free string (e.g. "0.1.0") -- lets an engine's own
  // internal session/scoring logic evolve without renaming its id.
  version: string
}
