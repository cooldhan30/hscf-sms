import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { currentAcademicYear } from '@/lib/academic-year'
import { buildStudentReport } from '@/lib/reports/studentReport'
import { StudentReportView } from '@/components/reports/StudentReportView'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const dynamic = 'force-dynamic'

export default async function StudentReportsPage() {
  const supabase = createClient()
  const { userId } = await auth()

  const { data: student } = await supabase.from('sms_students').select('id').eq('profile_id', userId ?? '').single()
  const academicYear = await currentAcademicYear(supabase)

  const { data: enrollments } = student
    ? await supabase.from('sms_class_enrollments').select('class_id').eq('student_id', student.id).neq('status', 'dropped')
    : { data: [] }

  const classIds = Array.from(new Set((enrollments ?? []).map((e) => e.class_id)))
  const report = student ? await buildStudentReport(supabase, student.id, classIds, academicYear) : null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Reports</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Your attendance and score report for {academicYear}.</p>
      </div>

      {report ? <StudentReportView report={report} academicYear={academicYear} /> : <EmptyState title="No report available yet" />}
    </div>
  )
}
