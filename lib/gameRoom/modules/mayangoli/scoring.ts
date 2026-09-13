import { calculatePoints } from '@/lib/gameRoom/scoring'

// Streak bonuses on top of the existing base+speed scoring
// (lib/gameRoom/scoring.ts's calculatePoints, reused unchanged here --
// per spec, "do not blindly replace existing scoring... extend it
// cleanly"). Awarded on the streak COUNT itself, not every question
// once a streak is reached -- i.e. the +100 fires exactly on the 3rd
// consecutive correct answer, +250 on the 5th, +500 on the 10th, not
// on every answer thereafter, matching the spec's "3 correct: +100"
// (a one-time milestone bonus, not a recurring per-answer multiplier).
const STREAK_BONUSES: Record<number, number> = {
  3: 100,
  5: 250,
  10: 500,
}

export interface MayangoliScoreResult {
  points: number
  streakBonus: number
  newStreak: number
}

// `currentStreak` is the player's streak BEFORE this answer (i.e.
// sms_mayangoli_players.current_streak as read prior to this update) --
// the caller is responsible for persisting newStreak back.
export function calculateMayangoliPoints(
  isCorrect: boolean,
  responseTimeMs: number,
  timeLimitSeconds: number,
  currentStreakBefore: number
): MayangoliScoreResult {
  const basePoints = calculatePoints(isCorrect, responseTimeMs, timeLimitSeconds)

  if (!isCorrect) {
    return { points: 0, streakBonus: 0, newStreak: 0 }
  }

  const newStreak = currentStreakBefore + 1
  const streakBonus = STREAK_BONUSES[newStreak] ?? 0

  return { points: basePoints + streakBonus, streakBonus, newStreak }
}
