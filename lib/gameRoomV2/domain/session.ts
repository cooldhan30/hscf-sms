import type { GameRoomQuestionType } from './questionTypes'

// Domain shapes for the gameplay framework -- backed by
// sms_gamev2_sessions/sms_gamev2_answers/sms_gamev2_player_stats since
// migration 076. These are the shapes every future engine (Classic
// Quiz, Tower Defense, Boss Battle, Racing, Treasure Quest, ...) reads/
// writes through the shared session lifecycle
// (lib/gameRoomV2/sessionLifecycle.ts) -- no engine invents its own
// session/scoring persistence.

export const GAME_SESSION_STATUSES = ['CREATED', 'READY', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED'] as const
export type GameSessionStatus = (typeof GAME_SESSION_STATUSES)[number]

export interface GameSession {
  id: string
  questionSetId: string
  engineId: string
  studentId: string
  status: GameSessionStatus
  questionOrder: string[]
  currentIndex: number
  currentQuestionStartedAt: string | null
  questionTimeLimitSeconds: number
  lives: number
  maxLives: number
  currentStreak: number
  bestStreak: number
  score: number
  correctCount: number
  answeredCount: number
  xpEarned: number
  coinsEarned: number
  pauseDurationSeconds: number
  pausedAt: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  abandonedAt: string | null
}

// One player's response to one question. `answer` is intentionally
// `unknown` here -- its real shape depends on the question's
// GameRoomQuestionType, mirroring how QuestionPayloadFor<T> varies per
// type in questionTypes.ts. A specific engine implementation narrows
// this to the concrete answer shape(s) it actually accepts.
export interface GameResponse {
  id: string
  sessionId: string
  questionId: string
  questionIndex: number
  questionType: GameRoomQuestionType
  answer: unknown
  isCorrect: boolean
  points: number
  responseTimeMs: number
  answeredAt: string
}

// The outcome of one full play session -- what the Results screen
// renders. `skillsPracticed` is populated from the question set's own
// subject/topic/tags (see sms_gamev2_skill_practice) -- the visible
// half of the mastery-analytics architecture migration 076 prepares;
// no mastery SCORE/report is computed from it yet, only the raw list
// of what was practiced this session.
export interface GameResult {
  sessionId: string
  score: number
  accuracyPct: number
  correctCount: number
  incorrectCount: number
  totalQuestions: number
  xpEarned: number
  coinsEarned: number
  bestStreak: number
  skillsPracticed: string[]
  responses: GameResponse[]
  // Achievement ids granted at the moment this session completed (see
  // lib/gameRoomV2/progression/achievements.ts) -- empty on a session
  // that didn't newly unlock anything, never populated on a later
  // re-fetch of an already-finalized session.
  newlyEarnedAchievementIds: string[]
}

// A reward earned from a session -- deliberately generic (not just
// points) so an engine can grant something engine-specific (a badge, an
// unlocked cosmetic) without the domain model needing to anticipate
// every engine's reward design up front. Not persisted by any table
// yet -- reserved for a future badges/achievements feature to build on.
export interface GameReward {
  id: string
  sessionId: string
  kind: string
  label: string
  value: number | null
  grantedAt: string
}
