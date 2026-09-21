import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { currentAcademicYear } from '@/lib/academic-year'
import { buildClassAttendanceReport } from '@/lib/reports/classAttendanceReport'

// GET /api/teacher/reports/attendance?classId=&academicYear=
// Whole-class attendance report: total classes held, and a per-student
// breakdown of Present/Absent/Tardy/Excused/Online counts + attendance
// %, plus the full date x student matrix (dates/students[].byDate) for
// the detailed export. RLS scopes sms_class_enrollments/sms_attendance
// reads to classes the teacher actually owns/co-teaches -- a classId
// that isn't theirs simply yields zero rows, same precedent as
// /api/teacher/reports/class.
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

  const report = await buildClassAttendanceReport(supabase, classId, academicYear)

  return NextResponse.json({ ...report, academicYear })
}
