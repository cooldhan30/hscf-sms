import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { currentAcademicYear } from '@/lib/academic-year'
import { buildStudentReport } from '@/lib/reports/studentReport'

// GET /api/teacher/reports/class?classId=...&academicYear=...
// One summary row per actively-enrolled student in the class -- the
// "whole class" report view. Each row reuses buildStudentReport scoped
// to just this one class, same math the per-student report uses.
export async function GET(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId')
  if (!classId) {
    return NextResponse.json({ error: 'classId is required' }, { status: 400 })
  }
  const academicYear = searchParams.get('academicYear') || (await currentAcademicYear(supabase))

  // RLS scopes sms_class_enrollments reads to classes the teacher
  // actually owns/co-teaches -- a classId that isn't theirs simply
  // yields zero rows here.
  const { data: enrollments } = await supabase
    .from('sms_class_enrollments')
    .select('student_id')
    .eq('class_id', classId)
    .eq('status', 'active')

  const studentIds = (enrollments ?? []).map((e) => e.student_id)

  const reports = await Promise.all(
    studentIds.map((studentId) => buildStudentReport(supabase, studentId, [classId], academicYear))
  )

  const rows = reports
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.studentName.localeCompare(b.studentName))

  return NextResponse.json({ rows, academicYear })
}
