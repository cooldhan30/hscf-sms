import { isUuid } from './validateQuestion'
import type { AssignmentSettings, Question, StudentAssignmentStatus } from './types'

// The rules of GameRoom Classic assignments, as plain functions so they
// can be checked without a database (scripts/verify-grc-assignments.ts).

export interface AttemptLike {
  status: 'in_progress' | 'submitted'
  attempt_no: number
  submitted_at: string | null
  percent: number | null
  deadline_at?: string | null
}

export interface AssignmentLike {
  due_at: string
  status: 'open' | 'closed'
  allow_late: boolean
  max_attempts: number | null
  score_policy: 'best' | 'latest'
  show_answers: 'after-due' | 'after-submit' | 'never'
}

const past = (iso: string, now: number) => new Date(iso).getTime() < now

export function attemptLimit(max: number | null, extra: number): number | null {
  return max === null ? null : max + Math.max(0, extra)
}

export function attemptsLeft(a: Pick<AssignmentLike, 'max_attempts'>, used: number, extra: number): number | null {
  const limit = attemptLimit(a.max_attempts, extra)
  return limit === null ? null : Math.max(0, limit - used)
}

// The submitted attempt whose score counts: the best one (earliest wins a
// tie) or the latest one, as the teacher chose.
export function countedAttempt<T extends AttemptLike>(attempts: T[], policy: 'best' | 'latest'): T | null {
  const done = attempts.filter((t) => t.status === 'submitted' && t.submitted_at)
  if (!done.length) return null
  const byTime = done.slice().sort((x, y) => new Date(x.submitted_at!).getTime() - new Date(y.submitted_at!).getTime())
  if (policy === 'latest') return byTime[byTime.length - 1]
  return byTime.reduce((best, t) => ((t.percent ?? 0) > (best.percent ?? 0) ? t : best))
}

export function studentStatus(a: AssignmentLike, attempts: AttemptLike[], now = Date.now()): StudentAssignmentStatus {
  if (attempts.some((t) => t.status === 'submitted')) return 'submitted'
  if (attempts.some((t) => t.status === 'in_progress') && a.status === 'open') return 'in-progress'
  if (a.status === 'closed' || past(a.due_at, now)) return 'overdue'
  return 'todo'
}

export type Verdict = { ok: true } | { ok: false; reason: string }

// May the student start (or carry on with) an attempt?
export function canStart(a: AssignmentLike, attempts: AttemptLike[], extra: number, now = Date.now()): Verdict {
  if (a.status === 'closed') return { ok: false, reason: 'Your teacher has closed this assignment.' }
  if (past(a.due_at, now) && !a.allow_late) return { ok: false, reason: 'The due date has passed. Ask your teacher if you can still do it.' }
  if (attempts.some((t) => t.status === 'in_progress')) return { ok: true }
  const left = attemptsLeft(a, attempts.length, extra)
  if (left !== null && left <= 0) return { ok: false, reason: 'You have used all your attempts.' }
  return { ok: true }
}

// May the student still answer questions in this attempt?
export function canAnswer(a: AssignmentLike, attempt: AttemptLike, now = Date.now()): Verdict {
  if (attempt.status !== 'in_progress') return { ok: false, reason: 'This attempt has already been submitted.' }
  if (a.status === 'closed') return { ok: false, reason: 'Your teacher has closed this assignment.' }
  if (past(a.due_at, now) && !a.allow_late) return { ok: false, reason: 'The due date has passed.' }
  if (attempt.deadline_at && past(attempt.deadline_at, now + 2000)) return { ok: false, reason: 'Time is up.' }
  return { ok: true }
}

// May the student see the right answers after submitting?
export function answersVisible(a: Pick<AssignmentLike, 'show_answers' | 'due_at'>, submitted: boolean, now = Date.now()): boolean {
  if (!submitted || a.show_answers === 'never') return false
  if (a.show_answers === 'after-submit') return true
  return past(a.due_at, now)
}

export function answersNote(a: Pick<AssignmentLike, 'show_answers' | 'due_at'>, now = Date.now()): string {
  if (a.show_answers === 'never') return 'Your teacher has chosen not to show the right answers.'
  if (a.show_answers === 'after-submit' || past(a.due_at, now)) return 'You can now see the right answers in your review.'
  return 'The right answers appear after the due date.'
}

// Grading units: a quiz or word question is 1, a matching board is 1 per pair.
export function unitsOf(q: Question): number {
  return q.kind === 'match' ? q.pairs.length : 1
}

export function percentOf(correct: number, total: number): number {
  return total > 0 ? Math.round((100 * correct) / total) : 0
}

// ---- Teacher input when publishing ----

export const ATTEMPT_CHOICES = [1, 2, 3, null] as const
export const TIMER_CHOICES = [null, 10, 20, 30] as const
export const PASSING_CHOICES = [null, 50, 70, 80] as const

export interface ValidAssignment {
  gameId: string
  classIds: string[]
  dueAt: string
  settings: AssignmentSettings
}

export function validateAssignment(body: Record<string, unknown>, now = Date.now()): { ok: true; value: ValidAssignment } | { ok: false; errors: string[] } {
  const errors: string[] = []
  if (!isUuid(body.gameId)) errors.push('Choose a game to assign.')
  const classIds = Array.isArray(body.classIds) ? Array.from(new Set(body.classIds.filter(isUuid))) : []
  if (!classIds.length) errors.push('Pick at least one class.')
  if (classIds.length > 20) errors.push('Pick at most 20 classes.')
  const due = typeof body.dueAt === 'string' ? new Date(body.dueAt) : null
  if (!due || Number.isNaN(due.getTime())) errors.push('Pick a due date.')
  else if (due.getTime() <= now) errors.push('Pick a due date in the future.')
  else if (due.getTime() > now + 366 * 24 * 3600 * 1000) errors.push('Pick a due date within the next year.')
  const s = (body.settings ?? {}) as Record<string, unknown>
  const pick = <T>(v: unknown, allowed: readonly T[], fallback: T, label: string): T => {
    if (v === undefined) return fallback
    if (allowed.includes(v as T)) return v as T
    errors.push(`${label} is not a valid choice.`)
    return fallback
  }
  const settings: AssignmentSettings = {
    maxAttempts: pick(s.maxAttempts, ATTEMPT_CHOICES, 2, 'Attempts'),
    timerMinutes: pick(s.timerMinutes, TIMER_CHOICES, null, 'Timer'),
    passingPercent: pick(s.passingPercent, PASSING_CHOICES, null, 'Passing score'),
    randomize: pick(s.randomize, [true, false], true, 'Shuffle'),
    allowLate: pick(s.allowLate, [true, false], false, 'Late submissions'),
    showAnswers: pick(s.showAnswers, ['after-due', 'after-submit', 'never'] as const, 'after-due', 'Show answers'),
    scorePolicy: pick(s.scorePolicy, ['best', 'latest'] as const, 'best', 'Score policy'),
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, value: { gameId: body.gameId as string, classIds: classIds as string[], dueAt: due!.toISOString(), settings } }
}
