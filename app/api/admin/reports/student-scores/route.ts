import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentAcademicYear } from '@/lib/academic-year'
import { buildStudentReport } from '@/lib/reports/studentReport'

// GET /api/admin/reports/student-scores?classId=...&studentId=...&academicYear=...
// Same shape as the teacher class/student report endpoints, but using
// the admin client (no RLS scoping) so any class or student works, not
// just the caller's own.
export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()
  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId')
  const studentId = searchParams.get('studentId')
  const academicYear = searchParams.get('academicYear') || (await currentAcademicYear(admin))

  if (studentId) {
    let classQuery = admin.from('sms_class_enrollments').select('class_id').eq('student_id', studentId).neq('status', 'dropped')
    if (classId) classQuery = classQuery.eq('class_id', classId)
    const { data: enrollments } = await classQuery
    const classIds = Array.from(new Set((enrollments ?? []).map((e) => e.class_id)))

    const report = await buildStudentReport(admin, studentId, classIds, academicYear)
    if (!report) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    return NextResponse.json({ report, academicYear })
  }

  if (!classId) {
    return NextResponse.json({ error: 'classId or studentId is required' }, { status: 400 })
  }

  const { data: enrollments } = await admin
    .from('sms_class_enrollments')
    .select('student_id')
    .eq('class_id', classId)
    .eq('status', 'active')

  const studentIds = (enrollments ?? []).map((e) => e.student_id)
  const reports = await Promise.all(studentIds.map((id) => buildStudentReport(admin, id, [classId], academicYear)))
  const rows = reports.filter((r): r is NonNullable<typeof r> => r !== null).sort((a, b) => a.studentName.localeCompare(b.studentName))

  return NextResponse.json({ rows, academicYear })
}
