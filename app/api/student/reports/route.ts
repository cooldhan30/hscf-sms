import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { currentAcademicYear } from '@/lib/academic-year'
import { buildStudentReport } from '@/lib/reports/studentReport'

// GET /api/student/reports?academicYear=... -- the caller's own
// full-year attendance + score report, across every class they're
// enrolled in for that year.
export async function GET(request: Request) {
  const guard = await requireStudent()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, student } = guard

  const { searchParams } = new URL(request.url)
  const academicYear = searchParams.get('academicYear') || (await currentAcademicYear(supabase))

  const { data: enrollments } = await supabase
    .from('sms_class_enrollments')
    .select('class_id')
    .eq('student_id', student.id)
    .neq('status', 'dropped')

  const classIds = Array.from(new Set((enrollments ?? []).map((e) => e.class_id)))

  const report = await buildStudentReport(supabase, student.id, classIds, academicYear)
  if (!report) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  return NextResponse.json({ report, academicYear })
}
