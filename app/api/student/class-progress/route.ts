import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'

// GET /api/student/class-progress?classId=
// Whole-class submission progress for every PUBLISHED assignment in one
// of the caller's own classes -- who's submitted, who hasn't. Never
// returns scores or submission content: sms_grades is never queried
// here, and sms_submissions is selected down to just
// (assignment_id, student_id, submitted_at) even though the new "read
// shared class" RLS policy would technically allow reading the whole
// row -- this route is the actual privacy boundary for
// content/file_url/audio_url, not RLS alone.
export async function GET(request: Request) {
  const guard = await requireStudent()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, student } = guard

  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId')
  if (!classId) {
    return NextResponse.json({ error: 'classId is required' }, { status: 400 })
  }

  // RLS ("enrollments: student read own") scopes this to the caller's
  // own enrollment rows -- a classId they aren't actually enrolled in
  // yields no row here, so the guard below naturally rejects it without
  // a separate ownership check.
  const { data: myEnrollment } = await supabase
    .from('sms_class_enrollments')
    .select('class_id')
    .eq('class_id', classId)
    .eq('student_id', student.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!myEnrollment) {
    return NextResponse.json({ error: 'You are not enrolled in this class' }, { status: 403 })
  }

  const [{ data: roster }, { data: assignments }, { data: submissions }] = await Promise.all([
    supabase
      .from('sms_class_enrollments')
      .select('student:sms_students(id, first_name, last_name)')
      .eq('class_id', classId)
      .eq('status', 'active')
      .returns<{ student: { id: string; first_name: string; last_name: string } }[]>(),
    supabase
      .from('sms_assignments')
      .select('id, title, assignment_type, due_date')
      .eq('class_id', classId)
      .eq('published', true)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('sms_submissions').select('assignment_id, student_id, submitted_at'),
  ])

  const students = (roster ?? []).map((r) => r.student).filter((s): s is { id: string; first_name: string; last_name: string } => Boolean(s))
  const rosterIds = new Set(students.map((s) => s.id))

  // sms_submissions has no class_id column, so this is filtered to the
  // roster in-memory rather than via another RLS-scoped query -- the
  // "student read shared class" policy already limits what came back to
  // classmates sharing at least one class with the caller, and this
  // narrows it further to exactly this class's roster.
  const submittedByAssignment = new Map<string, Map<string, string>>()
  for (const s of submissions ?? []) {
    if (!rosterIds.has(s.student_id)) continue
    if (!submittedByAssignment.has(s.assignment_id)) submittedByAssignment.set(s.assignment_id, new Map())
    submittedByAssignment.get(s.assignment_id)!.set(s.student_id, s.submitted_at)
  }

  const sortedStudents = [...students].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))

  const result = (assignments ?? []).map((a) => {
    const submittedMap = submittedByAssignment.get(a.id) ?? new Map()
    return {
      assignmentId: a.id,
      title: a.title,
      assignmentType: a.assignment_type,
      dueDate: a.due_date,
      students: sortedStudents.map((s) => ({
        studentId: s.id,
        studentName: `${s.first_name} ${s.last_name}`.trim(),
        submitted: submittedMap.has(s.id),
        submittedAt: submittedMap.get(s.id) ?? null,
      })),
      submittedCount: submittedMap.size,
      totalCount: sortedStudents.length,
    }
  })

  return NextResponse.json({ assignments: result })
}
