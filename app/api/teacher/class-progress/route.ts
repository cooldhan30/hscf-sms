import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { buildClassProgress } from '@/lib/classProgress'

// GET /api/teacher/class-progress?classId=
// Whole-class submission status for every PUBLISHED assignment in one of
// the caller's classes -- who's submitted and who still needs a
// reminder. Same shape as the student route; scores and submission
// content live in the gradebook, not here.
export async function GET(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId')
  if (!classId) {
    return NextResponse.json({ error: 'classId is required' }, { status: 400 })
  }

  // Co-teachers included -- same RLS helper the gradebook route uses.
  const { data: owns } = await supabase.rpc('sms_teacher_owns_class', { p_class_id: classId })
  if (!owns) {
    return NextResponse.json({ error: 'Class not found or not assigned to you' }, { status: 403 })
  }

  const [{ data: roster }, { data: assignments }] = await Promise.all([
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
      .eq('published', true),
  ])

  const assignmentIds = (assignments ?? []).map((a) => a.id)
  const { data: submissions } =
    assignmentIds.length > 0
      ? await supabase.from('sms_submissions').select('assignment_id, student_id, submitted_at').in('assignment_id', assignmentIds)
      : { data: [] }

  const students = (roster ?? []).map((r) => r.student).filter((s): s is { id: string; first_name: string; last_name: string } => Boolean(s))

  return NextResponse.json({ assignments: buildClassProgress(students, assignments ?? [], submissions ?? []) })
}
