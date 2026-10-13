import 'server-only'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStudent } from '@/lib/require-student'
import { answersNote, answersVisible, attemptLimit, attemptsLeft, canAnswer, canStart, countedAttempt, percentOf, studentStatus } from '../assignments'
import { checkResponse, toPlayQuestion, type CheckResult, type PlayQuestion, type PlayResponse } from '../play'
import { shuffle } from '../shuffle'
import type { Question, StudentAssignment, SubmitSummary } from '../types'
import { isGrClassicEnabled } from '../release'
import { ASSIGNMENT_COLUMNS, ATTEMPT_COLUMNS, questionResults, toAssignment, type AssignmentRow, type AttemptRow, type ResponseRow } from './assignmentRows'

// Student side of assignments. Students have NO direct access to any
// sms_grc_* table (migration 095). Everything goes through here, using
// the server-only service-role client -- so every query below is
// explicitly scoped to the signed-in student: their own sms_students id,
// assignments for classes they are actively enrolled in, and attempts
// they own. Answer keys never leave this file except as right/wrong.

type Student = { ok: true; admin: SupabaseClient; studentId: string; firstName: string }

export async function grcStudentApi(): Promise<Student | { ok: false; response: NextResponse }> {
  if (!isGrClassicEnabled()) return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const guard = await requireStudent()
  if (!guard.ok) return { ok: false, response: NextResponse.json({ error: guard.error }, { status: guard.status }) }
  return { ok: true, admin: createAdminClient(), studentId: guard.student.id, firstName: guard.student.first_name }
}

export async function grcStudentPage(path: string): Promise<Student | { ok: false; error: string }> {
  const { userId } = await auth()
  if (!userId) redirect(`/login?next=${encodeURIComponent(path)}`)
  const guard = await requireStudent()
  if (!guard.ok) return { ok: false, error: guard.error }
  return { ok: true, admin: createAdminClient(), studentId: guard.student.id, firstName: guard.student.first_name }
}

export class GrcError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

export function errorResponse(e: unknown, context: string): NextResponse {
  if (e instanceof GrcError) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error(`GameRoom Classic ${context} failed:`, e)
  return NextResponse.json({ error: 'Something went wrong. Your answers so far are saved — please try again.' }, { status: 500 })
}

async function enrolledClasses(admin: SupabaseClient, studentId: string): Promise<Map<string, string>> {
  const { data } = await admin.from('sms_class_enrollments').select('class_id, class:sms_classes(name)').eq('student_id', studentId).eq('status', 'active')
  return new Map(((data ?? []) as unknown as { class_id: string; class: { name: string } | null }[]).map((e) => [e.class_id, e.class?.name ?? 'Class']))
}

// An assignment this student may see: published to at least one class
// they are actively enrolled in. Returns null otherwise.
async function assignmentForStudent(admin: SupabaseClient, studentId: string, assignmentId: string) {
  const classes = await enrolledClasses(admin, studentId)
  if (!classes.size) return null
  const { data: links } = await admin.from('sms_grc_assignment_classes').select('class_id').eq('assignment_id', assignmentId).in('class_id', Array.from(classes.keys()))
  const classIds = ((links ?? []) as { class_id: string }[]).map((l) => l.class_id)
  if (!classIds.length) return null
  const { data } = await admin.from('sms_grc_assignments').select(ASSIGNMENT_COLUMNS).eq('id', assignmentId).maybeSingle()
  return data ? { row: data as AssignmentRow, classIds, className: classes.get(classIds[0]) ?? 'Class' } : null
}

async function attemptsOf(admin: SupabaseClient, studentId: string, assignmentId: string): Promise<AttemptRow[]> {
  const { data } = await admin.from('sms_grc_attempts').select(ATTEMPT_COLUMNS).eq('assignment_id', assignmentId).eq('student_id', studentId).order('attempt_no')
  return (data ?? []) as AttemptRow[]
}

async function extraAttempts(admin: SupabaseClient, studentId: string, assignmentId: string): Promise<number> {
  const { data } = await admin.from('sms_grc_attempt_grants').select('extra').eq('assignment_id', assignmentId).eq('student_id', studentId).maybeSingle()
  return (data as { extra: number } | null)?.extra ?? 0
}

async function contentOf(admin: SupabaseClient, assignmentId: string): Promise<Question[]> {
  const { data } = await admin.from('sms_grc_assignment_content').select('questions').eq('assignment_id', assignmentId).maybeSingle()
  return ((data as { questions: Question[] } | null)?.questions ?? []) as Question[]
}

// ---------- My Assignments ----------

export async function listStudentAssignments(admin: SupabaseClient, studentId: string): Promise<StudentAssignment[]> {
  const classes = await enrolledClasses(admin, studentId)
  if (!classes.size) return []
  const { data: links } = await admin.from('sms_grc_assignment_classes').select('assignment_id, class_id').in('class_id', Array.from(classes.keys()))
  const linkRows = (links ?? []) as { assignment_id: string; class_id: string }[]
  const ids = Array.from(new Set(linkRows.map((l) => l.assignment_id)))
  if (!ids.length) return []
  const [{ data: rows }, { data: attemptRows }, { data: grants }] = await Promise.all([
    admin.from('sms_grc_assignments').select(ASSIGNMENT_COLUMNS).in('id', ids),
    admin.from('sms_grc_attempts').select(ATTEMPT_COLUMNS).in('assignment_id', ids).eq('student_id', studentId),
    admin.from('sms_grc_attempt_grants').select('assignment_id, extra').in('assignment_id', ids).eq('student_id', studentId),
  ])
  const attempts = (attemptRows ?? []) as AttemptRow[]
  const extra = new Map(((grants ?? []) as { assignment_id: string; extra: number }[]).map((g) => [g.assignment_id, g.extra]))
  return ((rows ?? []) as AssignmentRow[])
    .map((a) => {
      const mine = attempts.filter((t) => t.assignment_id === a.id)
      const c = countedAttempt(mine, a.score_policy)
      const myClassIds = linkRows.filter((l) => l.assignment_id === a.id).map((l) => l.class_id)
      return {
        assignment: toAssignment(a, myClassIds),
        className: classes.get(myClassIds[0]) ?? 'Class',
        status: studentStatus(a, mine),
        attemptsUsed: mine.length,
        attemptLimit: attemptLimit(a.max_attempts, extra.get(a.id) ?? 0),
        bestPercent: c?.percent ?? null,
        submittedAt: c?.submitted_at ?? null,
        questions: [],
        answersVisible: answersVisible(a, Boolean(c)),
      } satisfies StudentAssignment
    })
    .sort((x, y) => new Date(x.assignment.dueAt).getTime() - new Date(y.assignment.dueAt).getTime())
}

export async function studentReview(admin: SupabaseClient, studentId: string, assignmentId: string): Promise<StudentAssignment | null> {
  const found = await assignmentForStudent(admin, studentId, assignmentId)
  if (!found) return null
  const a = found.row
  const mine = await attemptsOf(admin, studentId, assignmentId)
  const c = countedAttempt(mine, a.score_policy)
  const reveal = answersVisible(a, Boolean(c))
  let questions: StudentAssignment['questions'] = []
  if (c) {
    const [content, { data: responses }] = await Promise.all([contentOf(admin, assignmentId), admin.from('sms_grc_responses').select('attempt_id, question_id, response, correct_units, total_units, given, done').eq('attempt_id', c.id)])
    questions = questionResults(content, (responses ?? []) as ResponseRow[], reveal)
  }
  return {
    assignment: toAssignment(a, found.classIds),
    className: found.className,
    status: studentStatus(a, mine),
    attemptsUsed: mine.length,
    attemptLimit: attemptLimit(a.max_attempts, await extraAttempts(admin, studentId, assignmentId)),
    bestPercent: c?.percent ?? null,
    submittedAt: c?.submitted_at ?? null,
    questions,
    answersVisible: reveal,
  }
}

// ---------- Playing ----------

export interface StartedAttempt {
  attemptId: string
  title: string
  type: AssignmentRow['game_type']
  questions: PlayQuestion[]
  answeredIds: string[]
  deadlineAt: string | null
  attemptNo: number
  attemptsLeftAfter: number | null
}

// Start a new attempt, or pick up the unfinished one (same questions, same
// order, answered questions skipped). Safe to call twice: the database
// allows only one unfinished attempt per student and assignment.
export async function startAttempt(admin: SupabaseClient, studentId: string, assignmentId: string): Promise<StartedAttempt> {
  const found = await assignmentForStudent(admin, studentId, assignmentId)
  if (!found) throw new GrcError('Assignment not found.', 404)
  const a = found.row
  const extra = await extraAttempts(admin, studentId, assignmentId)
  let attempts = await attemptsOf(admin, studentId, assignmentId)
  const verdict = canStart(a, attempts, extra)
  if (!verdict.ok) {
    // Closed or past due while half done: hand in what was answered, so
    // the work counts instead of being stuck "in progress".
    const stranded = attempts.find((t) => t.status === 'in_progress')
    if (stranded) {
      await submitAttempt(admin, studentId, stranded.id)
      throw new GrcError(`${verdict.reason} The answers you already gave have been handed in.`, 409)
    }
    throw new GrcError(verdict.reason, 409)
  }

  let open = attempts.find((t) => t.status === 'in_progress')
  if (!open) {
    const content = await contentOf(admin, assignmentId)
    if (!content.length) throw new GrcError('This assignment has no questions.', 409)
    const ordered = a.randomize ? shuffle(content) : content
    const play = ordered.map(toPlayQuestion)
    const deadline = a.timer_minutes ? new Date(Date.now() + a.timer_minutes * 60_000).toISOString() : null
    const { error } = await admin.from('sms_grc_attempts').insert({
      assignment_id: assignmentId,
      student_id: studentId,
      attempt_no: Math.max(0, ...attempts.map((t) => t.attempt_no)) + 1,
      play,
      deadline_at: deadline,
    })
    // 23505 = another tab started one a moment ago; use that one.
    if (error && error.code !== '23505') throw error
    attempts = await attemptsOf(admin, studentId, assignmentId)
    open = attempts.find((t) => t.status === 'in_progress')
    if (!open) throw new GrcError('Could not start the assignment. Please try again.', 409)
  }

  const [{ data: playRow }, { data: done }] = await Promise.all([
    admin.from('sms_grc_attempts').select('play').eq('id', open.id).single(),
    admin.from('sms_grc_responses').select('question_id').eq('attempt_id', open.id).eq('done', true),
  ])
  const left = attemptsLeft(a, attempts.length, extra)
  return {
    attemptId: open.id,
    title: a.title,
    type: a.game_type,
    questions: (playRow as { play: PlayQuestion[] }).play,
    answeredIds: ((done ?? []) as { question_id: string }[]).map((r) => r.question_id),
    deadlineAt: open.deadline_at,
    attemptNo: open.attempt_no,
    attemptsLeftAfter: left,
  }
}

async function ownAttempt(admin: SupabaseClient, studentId: string, attemptId: string) {
  const { data } = await admin.from('sms_grc_attempts').select(ATTEMPT_COLUMNS).eq('id', attemptId).eq('student_id', studentId).maybeSingle()
  if (!data) throw new GrcError('Attempt not found.', 404)
  const attempt = data as AttemptRow
  // Still enrolled in a class this assignment was given to?
  const found = await assignmentForStudent(admin, studentId, attempt.assignment_id)
  if (!found) throw new GrcError('Assignment not found.', 404)
  return { attempt, a: found.row }
}

// Check (and store) one answer. Assignments never reveal the right answer.
// Only the FIRST answer to a question counts; asking again returns the
// stored result instead of re-grading. Matching stores the first pick for
// every item and checks each pairing as it happens.
export async function checkInAttempt(admin: SupabaseClient, studentId: string, attemptId: string, questionId: string, response: PlayResponse): Promise<CheckResult> {
  const { attempt, a } = await ownAttempt(admin, studentId, attemptId)
  const verdict = canAnswer(a, attempt)
  if (!verdict.ok) throw new GrcError(verdict.reason, 409)
  const question = (await contentOf(admin, a.id)).find((q) => q.id === questionId)
  if (!question) throw new GrcError('Question not found.', 404)

  const { data: existing } = await admin.from('sms_grc_responses').select('attempt_id, question_id, response, correct_units, total_units, given, done').eq('attempt_id', attemptId).eq('question_id', questionId).maybeSingle()
  const prev = existing as ResponseRow | null

  if (question.kind === 'match') {
    if (response.kind !== 'match' || !Number.isInteger(response.left) || !question.pairs[response.left]) throw new GrcError('Invalid answer.', 400)
    const picks = { ...((prev?.response.picks as Record<string, string>) ?? {}) }
    const matched = new Set((prev?.response.matched as number[]) ?? [])
    const correct = question.pairs[response.left].right === response.right
    if (picks[response.left] === undefined) picks[response.left] = response.right
    if (correct) matched.add(response.left)
    const firstRight = question.pairs.filter((p, i) => picks[i] === p.right).length
    const misses = question.pairs.flatMap((p, i) => (picks[i] !== undefined && picks[i] !== p.right ? [`${p.left} → ${picks[i]}`] : []))
    const { error } = await admin.from('sms_grc_responses').upsert({
      attempt_id: attemptId,
      question_id: questionId,
      response: { picks, matched: Array.from(matched).sort((x, y) => x - y) },
      correct_units: firstRight,
      total_units: question.pairs.length,
      given: misses.length ? misses.join(', ') : 'All pairs right',
      done: matched.size === question.pairs.length,
      answered_at: new Date().toISOString(),
    })
    if (error) throw error
    return { correct }
  }

  if (prev) return { correct: prev.correct_units >= prev.total_units }
  const result = checkResponse(question, response, false)
  const given = response.kind === 'choice' && question.kind === 'choice' ? (question.options[response.choice] ?? '') : response.kind === 'order' ? response.tiles.join(question.kind === 'order' && question.unit === 'words' ? ' ' : '') : ''
  const { error } = await admin.from('sms_grc_responses').upsert(
    { attempt_id: attemptId, question_id: questionId, response, correct_units: result.correct ? 1 : 0, total_units: 1, given, done: true },
    { onConflict: 'attempt_id,question_id', ignoreDuplicates: true }
  )
  if (error) throw error
  // If another request stored an answer first, report that one.
  const { data: stored } = await admin.from('sms_grc_responses').select('correct_units, total_units').eq('attempt_id', attemptId).eq('question_id', questionId).single()
  const s = stored as { correct_units: number; total_units: number }
  return { correct: s.correct_units >= s.total_units }
}

// Finish & Submit. Grades from the stored answers (unanswered = 0) and is
// safe to repeat: a second submit returns the first result, never a
// second grade.
export async function submitAttempt(admin: SupabaseClient, studentId: string, attemptId: string): Promise<SubmitSummary> {
  const { attempt, a } = await ownAttempt(admin, studentId, attemptId)
  if (attempt.status === 'in_progress') {
    const { data: responses } = await admin.from('sms_grc_responses').select('correct_units').eq('attempt_id', attemptId)
    const correct = ((responses ?? []) as { correct_units: number }[]).reduce((n, r) => n + r.correct_units, 0)
    const now = new Date()
    const { error } = await admin
      .from('sms_grc_attempts')
      .update({ status: 'submitted', submitted_at: now.toISOString(), correct_units: correct, total_units: a.total_units, percent: percentOf(correct, a.total_units), late: now.getTime() > new Date(a.due_at).getTime() })
      .eq('id', attemptId)
      .eq('status', 'in_progress')
    if (error) throw error
  }
  const { data } = await admin.from('sms_grc_attempts').select(ATTEMPT_COLUMNS).eq('id', attemptId).single()
  const done = data as AttemptRow
  if (done.status !== 'submitted' || !done.submitted_at) throw new GrcError('Could not submit. Your answers are saved — please try again.', 409)
  const used = (await attemptsOf(admin, studentId, a.id)).length
  return {
    submittedAt: done.submitted_at,
    percent: done.percent ?? 0,
    correct: done.correct_units ?? 0,
    total: done.total_units ?? a.total_units,
    attemptsLeft: a.status === 'open' ? attemptsLeft(a, used, await extraAttempts(admin, studentId, a.id)) : 0,
    late: done.late,
    answersNote: answersNote(a),
  }
}
