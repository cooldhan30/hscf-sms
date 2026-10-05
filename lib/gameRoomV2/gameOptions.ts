// The two settings the GameRoom home lets a player (or a teacher hosting
// live) choose before a game: how many questions, and how long each one
// may take. Both are re-validated on the server (sessions/start and
// live/host); these helpers are the single rule for both routes.

// Must match the CHECK on question_time_limit_seconds (migrations 076, 079).
export const TIME_LIMIT_OPTIONS = [10, 15, 20, 30, 60] as const
export const DEFAULT_TIME_LIMIT = 20

// The quick picks on the home screen; "All" is sent as no count.
export const QUESTION_COUNT_OPTIONS = [5, 10, 15] as const

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

// Missing means the default (20 s).
export function parseTimeLimit(raw: unknown): Parsed<number> {
  if (raw === undefined || raw === null) return { ok: true, value: DEFAULT_TIME_LIMIT }
  const n = Number(raw)
  if (!(TIME_LIMIT_OPTIONS as readonly number[]).includes(n)) {
    return { ok: false, error: `Time per question must be one of ${TIME_LIMIT_OPTIONS.join(', ')} seconds` }
  }
  return { ok: true, value: n }
}

// Missing means every question (null). A count above what the set has is
// refused, so nobody is told "10 questions" and gets 6.
export function parseQuestionCount(raw: unknown, available: number): Parsed<number | null> {
  if (raw === undefined || raw === null) return { ok: true, value: null }
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return { ok: false, error: 'Question count must be a positive whole number' }
  if (n > available) return { ok: false, error: `This question set only has ${available} question${available === 1 ? '' : 's'}` }
  return { ok: true, value: n }
}
