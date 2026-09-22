import type { GameRoomQuestionType } from './questionTypes'

// Domain shapes for a play session. NOTE: no sms_gamev2_sessions/
// players/answers tables exist yet -- per the foundation's scope (see
// migration 073's header comment), only the content model
// (question sets/questions) and the access gate are persisted so far.
// These interfaces describe the shape a future engine implementation
// will produce/consume once a specific engine (e.g. Classic Quiz) is
// actually built end-to-end, so the domain boundary is settled before
// any single engine's persistence design is locked in.

export const GAME_SESSION_STATUSES = ['waiting', 'active', 'paused', 'ended'] as const
export type GameSessionStatus = (typeof GAME_SESSION_STATUSES)[number]

export interface GameSession {
  id: string
  questionSetId: string
  engineId: string
  hostTeacherId: string | null
  hostStudentId: string | null
  isSoloPractice: boolean
  status: GameSessionStatus
  createdAt: string
  startedAt: string | null
  endedAt: string | null
}

export interface GamePlayer {
  id: string
  sessionId: string
  studentId: string
  nickname: string
  score: number
  correctCount: number
  answeredCount: number
  completed: boolean
  joinedAt: string
  completedAt: string | null
}

// One player's response to one question. `answer` is intentionally
// `unknown` here -- its real shape depends on the question's
// GameRoomQuestionType (a selected option string for MULTIPLE_CHOICE,
// an ordered array for ORDER_WORDS, a category map for CATEGORIZE,
// etc), mirroring how QuestionPayloadFor<T> varies per type in
// questionTypes.ts. A specific engine implementation narrows this to
// the concrete answer shape(s) it actually accepts.
export interface GameResponse {
  id: string
  playerId: string
  questionId: string
  questionType: GameRoomQuestionType
  answer: unknown
  isCorrect: boolean
  points: number
  responseTimeMs: number
  answeredAt: string
}

// The outcome of one full play session for one player -- what a
// results/review screen renders.
export interface GameResult {
  sessionId: string
  playerId: string
  finalScore: number
  correctCount: number
  totalQuestions: number
  rank: number | null
  responses: GameResponse[]
}

// A reward earned from a session -- deliberately generic (not just
// points) so an engine can grant something engine-specific (a badge, an
// unlocked cosmetic, a streak) without the domain model needing to
// anticipate every engine's reward design up front.
export interface GameReward {
  id: string
  playerId: string
  sessionId: string
  kind: string
  label: string
  value: number | null
  grantedAt: string
}
