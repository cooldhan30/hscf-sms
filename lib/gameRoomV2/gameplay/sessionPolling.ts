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
}

export interface GameResultShape extends CompletePayload {
  responses: never[]
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
