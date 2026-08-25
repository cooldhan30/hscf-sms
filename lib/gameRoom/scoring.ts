// Kahoot-style scoring: 1000 base points for a correct answer, plus up
// to 500 speed bonus scaled by how much time was left when the student
// answered. Always computed server-side (never trust a client-supplied
// point value) using a server-recorded question-start timestamp -- see
// sms_game_players.current_question_started_at and app/api/game-room/
// answer/route.ts.
const BASE_POINTS = 1000
const MAX_SPEED_BONUS = 500

export function calculatePoints(isCorrect: boolean, responseTimeMs: number, timeLimitSeconds: number): number {
  if (!isCorrect) return 0

  const timeLimitMs = timeLimitSeconds * 1000
  const remainingMs = Math.max(0, timeLimitMs - responseTimeMs)
  const speedRatio = remainingMs / timeLimitMs

  return Math.round(BASE_POINTS + MAX_SPEED_BONUS * speedRatio)
}
