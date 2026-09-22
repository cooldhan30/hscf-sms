// Forked from lib/gameRoom/scoring.ts rather than imported -- same
// isolation rationale as shuffle.ts in this directory.
//
// Kahoot-style scoring: 1000 base points for a correct answer, plus up
// to 500 speed bonus scaled by how much time was left when the student
// answered. Always computed server-side (never trust a client-supplied
// point value) using the session's own server-recorded question-start
// timestamp (sms_gamev2_sessions.current_question_started_at).
const BASE_POINTS = 1000
const MAX_SPEED_BONUS = 500

export function calculatePoints(isCorrect: boolean, responseTimeMs: number, timeLimitSeconds: number): number {
  if (!isCorrect) return 0

  const timeLimitMs = timeLimitSeconds * 1000
  const remainingMs = Math.max(0, timeLimitMs - responseTimeMs)
  const speedRatio = remainingMs / timeLimitMs

  return Math.round(BASE_POINTS + MAX_SPEED_BONUS * speedRatio)
}

// XP and coins are deliberately separate from `points` (the in-session
// score Kahoot-style formula above produces) -- XP/coins are the
// durable, cross-session reward currency (see
// sms_gamev2_player_stats), while `points`/`score` are session-local
// and reset every game. A streak bonus rewards sustained correctness
// within one session without needing every engine to reimplement its
// own streak-to-reward math.
const XP_PER_CORRECT_ANSWER = 10
const COINS_PER_CORRECT_ANSWER = 2
const STREAK_XP_BONUS_PER_STREAK = 2
const STREAK_BONUS_CAP = 10 // caps the bonus at a 10-question streak's worth

export function calculateRewardsForAnswer(isCorrect: boolean, currentStreak: number): { xp: number; coins: number } {
  if (!isCorrect) return { xp: 0, coins: 0 }

  const streakBonusXp = Math.min(currentStreak, STREAK_BONUS_CAP) * STREAK_XP_BONUS_PER_STREAK
  return {
    xp: XP_PER_CORRECT_ANSWER + streakBonusXp,
    coins: COINS_PER_CORRECT_ANSWER,
  }
}

// A flat completion bonus, awarded once when a session finishes --
// separate from per-answer rewards so "finishing the game" itself is
// always worth something, even for a student who got every question
// wrong along the way.
const COMPLETION_XP_BONUS = 25
const COMPLETION_COINS_BONUS = 5

export function calculateCompletionBonus(): { xp: number; coins: number } {
  return { xp: COMPLETION_XP_BONUS, coins: COMPLETION_COINS_BONUS }
}
