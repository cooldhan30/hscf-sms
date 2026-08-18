import { createAdminClient } from '@/lib/supabase/admin'
import { currentAcademicYear } from '@/lib/academic-year'
import { ClassReportsClient } from '@/components/reports/ClassReportsClient'

export const dynamic = 'force-dynamic'

export default async function AdminScoreReportPage() {
  const admin = createAdminClient()
  const academicYear = await currentAcademicYear(admin)

  const { data: classes } = await admin.from('sms_classes').select('id, name').eq('academic_year', academicYear).order('name')

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Attendance &amp; Score Reports</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Attendance and score reports for {academicYear} — any class, or drill into one student.
        </p>
      </div>

      <ClassReportsClient classes={classes ?? []} academicYear={academicYear} apiEndpoint="/api/admin/reports/student-scores" />
    </div>
  )
}
