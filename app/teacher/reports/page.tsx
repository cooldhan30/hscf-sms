import { createClient } from '@/lib/supabase/server'
import { currentAcademicYear } from '@/lib/academic-year'
import { ReportTypeSwitcher } from '@/components/reports/ReportTypeSwitcher'

export const dynamic = 'force-dynamic'

export default async function TeacherReportsPage() {
  const supabase = createClient()
  const academicYear = await currentAcademicYear(supabase)

  // RLS scopes this to the teacher's own (or co-taught) classes.
  const { data: classes } = await supabase
    .from('sms_classes')
    .select('id, name')
    .eq('academic_year', academicYear)
    .order('name')

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Reports</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Attendance and score reports for {academicYear} — for a whole class or one student.
        </p>
      </div>

      <ReportTypeSwitcher classes={classes ?? []} academicYear={academicYear} apiEndpoint="/api/teacher/reports/class" />
    </div>
  )
}
