// Pure, DOM-free helpers backing useGameSessionState.ts. Split out so
// the request-building/response-shaping logic (the part worth
// asserting on) can be exercised by a plain tsx verify script without
// needing React or a browser -- see
// scripts/verify-gameroom-v2-shared-framework.ts.

export type GameSessionStatus = 'CREATED' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'

export interface BaseSessionStatePayload {
  status: GameSessionStatus
  currentIndex: number
  totalQuestions: number
}

export interface CompletePayload {
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
  // Already computed and sent by /complete (see that route's own
  // comment: granted exactly once, empty on any later re-fetch of an
  // already-finalized session) -- previously received here and then
  // silently dropped before reaching GameResultShape, so no engine's
  // Results screen could ever show "you unlocked an achievement" or
  // play the achievement sound for it. Optional because a few older
  // callers of buildGameResult() in tests construct a CompletePayload
  // by hand without this field.
  newlyEarnedAchievementIds?: string[]
}

export interface GameResultShape extends CompletePayload {
  responses: never[]
  // Always present here (buildGameResult defaults to []) even though
  // it's optional on the raw CompletePayload coming off the wire.
  newlyEarnedAchievementIds: string[]
}

// Every engine's completion effect builds the exact same GameResult
// shape from the /complete route's response, with responses always
// empty (see GameSessionRuntime.tsx's own comment: this screen never
// recomputes score client-side). Centralizing this removes 6
// byte-for-byte-identical object literals.
export function buildGameResult(data: CompletePayload): GameResultShape {
  return {
    sessionId: data.sessionId,
    score: data.score,
    accuracyPct: data.accuracyPct,
    correctCount: data.correctCount,
    incorrectCount: data.incorrectCount,
    totalQuestions: data.totalQuestions,
    xpEarned: data.xpEarned,
    coinsEarned: data.coinsEarned,
    bestStreak: data.bestStreak,
    skillsPracticed: data.skillsPracticed,
    newlyEarnedAchievementIds: data.newlyEarnedAchievementIds ?? [],
    responses: [],
  }
}

// Whether a session in `status` still needs an /abandon call before
// exiting -- true for every status except the two terminal ones. Used
// by every engine's exit handler; a session already COMPLETED or
// ABANDONED must never be abandoned again.
export function shouldAbandonOnExit(status: GameSessionStatus | undefined): boolean {
  return status !== undefined && status !== 'COMPLETED' && status !== 'ABANDONED'
}

// The pause/resume toggle always POSTs to the opposite of the current
// status -- this is the one-line decision every engine's
// handleTogglePause duplicated.
export function pauseToggleEndpoint(status: GameSessionStatus): 'pause' | 'resume' {
  return status === 'PAUSED' ? 'resume' : 'pause'
}
