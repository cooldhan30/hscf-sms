import 'server-only'
import { unitsOf } from '../assignments'
import { expectedText } from '../play'
import type { Assignment, GameType, Question, QuestionResult } from '../types'

export const ASSIGNMENT_COLUMNS = 'id, game_id, title, game_type, due_at, status, max_attempts, timer_minutes, passing_percent, randomize, allow_late, show_answers, score_policy, question_count, total_units'

export interface AssignmentRow {
  id: string
  game_id: string | null
  title: string
  game_type: GameType
  due_at: string
  status: 'open' | 'closed'
  max_attempts: number | null
  timer_minutes: number | null
  passing_percent: number | null
  randomize: boolean
  allow_late: boolean
  show_answers: 'after-due' | 'after-submit' | 'never'
  score_policy: 'best' | 'latest'
  question_count: number
  total_units: number
}

export const ATTEMPT_COLUMNS = 'id, assignment_id, student_id, attempt_no, status, started_at, deadline_at, submitted_at, correct_units, total_units, percent, late'

export interface AttemptRow {
  id: string
  assignment_id: string
  student_id: string
  attempt_no: number
  status: 'in_progress' | 'submitted'
  started_at: string
  deadline_at: string | null
  submitted_at: string | null
  correct_units: number | null
  total_units: number | null
  percent: number | null
  late: boolean
}

export interface ResponseRow {
  attempt_id: string
  question_id: string
  response: Record<string, unknown>
  correct_units: number
  total_units: number
  given: string
  done: boolean
}

export function toAssignment(row: AssignmentRow, classIds: string[]): Assignment {
  return {
    id: row.id,
    gameId: row.game_id,
    title: row.title,
    type: row.game_type,
    classIds,
    dueAt: row.due_at,
    status: row.status,
    questionCount: row.question_count,
    settings: {
      maxAttempts: row.max_attempts,
      timerMinutes: row.timer_minutes,
      passingPercent: row.passing_percent,
      randomize: row.randomize,
      allowLate: row.allow_late,
      showAnswers: row.show_answers,
      scorePolicy: row.score_policy,
    },
  }
}

// Question-by-question results of one attempt, in the frozen question
// order. Unanswered questions score 0. `reveal` = may the right answers
// be shown to whoever is looking.
export function questionResults(questions: Question[], responses: ResponseRow[], reveal: boolean): QuestionResult[] {
  const byId = new Map(responses.map((r) => [r.question_id, r]))
  return questions.map((q) => {
    const r = byId.get(q.id)
    return {
      questionId: q.id,
      prompt: q.prompt,
      correctUnits: r?.correct_units ?? 0,
      totalUnits: r?.total_units ?? unitsOf(q),
      given: r ? r.given : 'Not answered',
      expected: reveal ? expectedText(q) : '',
    }
  })
}
