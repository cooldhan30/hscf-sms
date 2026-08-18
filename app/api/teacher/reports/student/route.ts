import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { currentAcademicYear } from '@/lib/academic-year'
import { buildStudentReport } from '@/lib/reports/studentReport'

// GET /api/teacher/reports/student?studentId=...&classId=...&academicYear=...
// One student's full-year attendance + score report, scoped to the
// requesting teacher's own classes. classId narrows to a single class;
// omitted, it covers every class of the teacher's that the student is
// (or was) enrolled in for the given year.
export async function GET(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId')
  const classId = searchParams.get('classId')
  if (!studentId) {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
  }

  const academicYear = searchParams.get('academicYear') || (await currentAcademicYear(supabase))

  // RLS ("classes: teacher manage own") already scopes this select to
  // classes the requesting teacher actually owns/co-teaches -- a
  // studentId from someone else's class simply yields no matching rows
  // below, never a leaked report.
  let classQuery = supabase
    .from('sms_class_enrollments')
    .select('class_id')
    .eq('student_id', studentId)
    .neq('status', 'dropped')
  if (classId) classQuery = classQuery.eq('class_id', classId)

  const { data: enrollments } = await classQuery
  const classIds = Array.from(new Set((enrollments ?? []).map((e) => e.class_id)))

  const report = await buildStudentReport(supabase, studentId, classIds, academicYear)
  if (!report) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  return NextResponse.json({ report, academicYear })
}
