// Daily PRACTICE streak logic -- distinct from an in-session ANSWER
// streak (sms_gamev2_sessions.current_streak/best_streak, which resets
// per session and measures consecutive correct answers). A practice
// streak measures consecutive CALENDAR DAYS with at least one completed
// session, tracked once per student on sms_gamev2_player_stats
// (last_active_date/current_daily_streak/best_daily_streak).
//
// Dates are plain 'YYYY-MM-DD' strings (already normalized to the
// server's date by the caller) so this stays pure and timezone-neutral
// -- this module never calls `new Date()` itself.
export interface StreakUpdateResult {
  currentDailyStreak: number
  bestDailyStreak: number
  lastActiveDate: string
}

function daysBetween(earlier: string, later: string): number {
  const a = new Date(`${earlier}T00:00:00Z`).getTime()
  const b = new Date(`${later}T00:00:00Z`).getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

// Applies "a session was completed today" to the student's existing
// streak state. Three cases:
// - No prior activity, or the last activity was today already:
//   streak stays at least 1 (first-ever session starts a streak of 1;
//   a second session on the same day doesn't double-count).
// - The last activity was exactly yesterday: the streak continues,
//   incrementing by 1.
// - The last activity was 2+ days ago (or is somehow in the future,
//   which should never happen but is handled without throwing): the
//   streak resets to 1 -- a gap breaks it, no partial credit.
export function applyDailyActivity(
  today: string,
  previous: { lastActiveDate: string | null; currentDailyStreak: number; bestDailyStreak: number }
): StreakUpdateResult {
  let currentDailyStreak: number

  if (!previous.lastActiveDate) {
    currentDailyStreak = 1
  } else {
    const gap = daysBetween(previous.lastActiveDate, today)
    if (gap === 0) {
      currentDailyStreak = Math.max(1, previous.currentDailyStreak)
    } else if (gap === 1) {
      currentDailyStreak = previous.currentDailyStreak + 1
    } else {
      // gap > 1 (missed at least one day) or gap < 0 (clock oddity) --
      // either way, this is not a continuation.
      currentDailyStreak = 1
    }
  }

  return {
    currentDailyStreak,
    bestDailyStreak: Math.max(previous.bestDailyStreak, currentDailyStreak),
    lastActiveDate: today,
  }
}
