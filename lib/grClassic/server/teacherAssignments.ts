import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { attemptLimit, countedAttempt, studentStatus, unitsOf, type ValidAssignment } from '../assignments'
import type { Assignment, AssignmentSummary, Game, Question, StudentResult, TeacherClass } from '../types'
import { ASSIGNMENT_COLUMNS, ATTEMPT_COLUMNS, questionResults, toAssignment, type AssignmentRow, type AttemptRow, type ResponseRow } from './assignmentRows'

// Teacher-side reads and writes for assignments. All through the
// teacher's own RLS-scoped client: they see assignments they made, plus
// (migration 098) read-only ones a co-teacher gave to a class they teach,
// and only classes and students they teach.

export async function teacherClasses(supabase: SupabaseClient): Promise<TeacherClass[]> {
  const { data } = await supabase.from('sms_classes').select('id, name, enrollments:sms_class_enrollments(count)').eq('enrollments.status', 'active').order('name')
  return ((data ?? []) as { id: string; name: string; enrollments: { count: number }[] }[]).map((c) => ({ id: c.id, name: c.name, studentCount: c.enrollments?.[0]?.count ?? 0 }))
}

export async function publishAssignment(supabase: SupabaseClient, game: Game, v: ValidAssignment) {
  const questions: Question[] = game.questions
  return supabase.rpc('sms_grc_publish_assignment', {
    p_game_id: game.id,
    p_title: game.title,
    p_game_type: game.type,
    p_class_ids: v.classIds,
    p_due_at: v.dueAt,
    p_max_attempts: v.settings.maxAttempts,
    p_timer_minutes: v.settings.timerMinutes,
    p_passing_percent: v.settings.passingPercent,
    p_randomize: v.settings.randomize,
    p_allow_late: v.settings.allowLate,
    p_show_answers: v.settings.showAnswers,
    p_score_policy: v.settings.scorePolicy,
    p_questions: questions,
    p_question_count: questions.length,
    p_total_units: questions.reduce((n, q) => n + unitsOf(q), 0),
  })
}

interface Roster {
  classNames: Map<string, string>
  // student id -> first class (of this assignment) they are enrolled in
  studentClass: Map<string, string>
  byClass: Map<string, Set<string>>
}

async function rosterFor(supabase: SupabaseClient, classIds: string[]): Promise<Roster> {
  if (!classIds.length) return { classNames: new Map(), studentClass: new Map(), byClass: new Map() }
  const [{ data: classes }, { data: enrollments }] = await Promise.all([
    supabase.from('sms_classes').select('id, name').in('id', classIds),
    supabase.from('sms_class_enrollments').select('class_id, student_id').in('class_id', classIds).eq('status', 'active'),
  ])
  const studentClass = new Map<string, string>()
  const byClass = new Map<string, Set<string>>()
  for (const e of (enrollments ?? []) as { class_id: string; student_id: string }[]) {
    if (!studentClass.has(e.student_id)) studentClass.set(e.student_id, e.class_id)
    if (!byClass.has(e.class_id)) byClass.set(e.class_id, new Set())
    byClass.get(e.class_id)!.add(e.student_id)
  }
  return { classNames: new Map(((classes ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])), studentClass, byClass }
}

async function teacherNames(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const { data } = await supabase.from('sms_profiles').select('id, first_name, last_name').in('id', ids)
  return new Map(((data ?? []) as { id: string; first_name: string; last_name: string }[]).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]))
}

export async function listTeacherAssignments(supabase: SupabaseClient, userId: string): Promise<AssignmentSummary[]> {
  const { data: rows } = await supabase.from('sms_grc_assignments').select(ASSIGNMENT_COLUMNS).order('due_at', { ascending: false }).limit(200)
  const assignments = (rows ?? []) as AssignmentRow[]
  if (!assignments.length) return []
  const ids = assignments.map((a) => a.id)
  const [{ data: links }, { data: attempts }] = await Promise.all([
    supabase.from('sms_grc_assignment_classes').select('assignment_id, class_id').in('assignment_id', ids),
    supabase.from('sms_grc_attempts').select('assignment_id, student_id').in('assignment_id', ids).eq('status', 'submitted'),
  ])
  const linkRows = (links ?? []) as { assignment_id: string; class_id: string }[]
  const [roster, owners] = await Promise.all([rosterFor(supabase, Array.from(new Set(linkRows.map((l) => l.class_id)))), teacherNames(supabase, Array.from(new Set(assignments.map((a) => a.owner_id))))])
  const submitted = new Map<string, Set<string>>()
  for (const t of (attempts ?? []) as { assignment_id: string; student_id: string }[]) {
    if (!submitted.has(t.assignment_id)) submitted.set(t.assignment_id, new Set())
    submitted.get(t.assignment_id)!.add(t.student_id)
  }
  const byClass = roster.byClass
  return assignments.map((a) => {
    const classIds = linkRows.filter((l) => l.assignment_id === a.id).map((l) => l.class_id)
    const students = new Set(classIds.flatMap((c) => Array.from(byClass.get(c) ?? [])))
    const done = Array.from(submitted.get(a.id) ?? []).filter((s) => students.has(s)).length
    return { id: a.id, mine: a.owner_id === userId, ownerName: owners.get(a.owner_id) ?? 'Another teacher', title: a.title, type: a.game_type, classNames: classIds.map((c) => roster.classNames.get(c) ?? 'Class'), dueAt: a.due_at, status: a.status, submitted: done, students: students.size }
  })
}

export interface AssignmentResultsView {
  assignment: Assignment
  canManage: boolean // made by this teacher (co-teachers only view)
  ownerName: string
  classes: { id: string; name: string }[]
  results: StudentResult[]
}

export async function assignmentResults(supabase: SupabaseClient, id: string, userId: string): Promise<AssignmentResultsView | null> {
  const { data: row } = await supabase.from('sms_grc_assignments').select(ASSIGNMENT_COLUMNS).eq('id', id).maybeSingle()
  if (!row) return null
  const a = row as AssignmentRow
  const [{ data: links }, { data: content }, { data: attemptRows }, { data: grants }] = await Promise.all([
    supabase.from('sms_grc_assignment_classes').select('class_id').eq('assignment_id', id),
    supabase.from('sms_grc_assignment_content').select('questions').eq('assignment_id', id).maybeSingle(),
    supabase.from('sms_grc_attempts').select(ATTEMPT_COLUMNS).eq('assignment_id', id),
    supabase.from('sms_grc_attempt_grants').select('student_id, extra').eq('assignment_id', id),
  ])
  const classIds = ((links ?? []) as { class_id: string }[]).map((l) => l.class_id)
  const roster = await rosterFor(supabase, classIds)
  const studentIds = Array.from(roster.studentClass.keys())
  const { data: students } = studentIds.length ? await supabase.from('sms_students').select('id, first_name, last_name').in('id', studentIds) : { data: [] }
  const questions = ((content as { questions: Question[] } | null)?.questions ?? []) as Question[]
  const attempts = (attemptRows ?? []) as AttemptRow[]
  const extra = new Map(((grants ?? []) as { student_id: string; extra: number }[]).map((g) => [g.student_id, g.extra]))

  const counted = new Map<string, AttemptRow>()
  for (const sid of studentIds) {
    const c = countedAttempt(attempts.filter((t) => t.student_id === sid), a.score_policy)
    if (c) counted.set(sid, c)
  }
  const countedIds = Array.from(counted.values()).map((t) => t.id)
  const { data: responseRows } = countedIds.length ? await supabase.from('sms_grc_responses').select('attempt_id, question_id, response, correct_units, total_units, given, done').in('attempt_id', countedIds) : { data: [] }
  const responses = (responseRows ?? []) as ResponseRow[]

  const names = new Map(((students ?? []) as { id: string; first_name: string; last_name: string }[]).map((s) => [s.id, `${s.first_name} ${s.last_name}`.trim()]))
  const results: StudentResult[] = studentIds
    .map((sid) => {
      const mine = attempts.filter((t) => t.student_id === sid)
      const c = counted.get(sid) ?? null
      const st = studentStatus(a, mine)
      return {
        studentId: sid,
        name: names.get(sid) ?? 'Student',
        classId: roster.studentClass.get(sid)!,
        status: st === 'submitted' ? 'submitted' : st === 'in-progress' ? 'in-progress' : 'not-started',
        percent: c?.percent ?? null,
        attemptsUsed: mine.length,
        extraAttempts: extra.get(sid) ?? 0,
        attemptLimit: attemptLimit(a.max_attempts, extra.get(sid) ?? 0),
        submittedAt: c?.submitted_at ?? null,
        late: c?.late ?? false,
        // Teachers always see the right answers.
        questions: c ? questionResults(questions, responses.filter((r) => r.attempt_id === c.id), true) : [],
      } satisfies StudentResult
    })
    .sort((x, y) => x.name.localeCompare(y.name))

  const owner = a.owner_id === userId ? '' : ((await teacherNames(supabase, [a.owner_id])).get(a.owner_id) ?? 'Another teacher')
  return { assignment: toAssignment(a, classIds), canManage: a.owner_id === userId, ownerName: owner, classes: classIds.map((c) => ({ id: c, name: roster.classNames.get(c) ?? 'Class' })), results }
}
