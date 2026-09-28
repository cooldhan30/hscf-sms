import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSchoolEventsByDate } from '@/lib/schoolCalendar'
import { AttendanceClient } from './AttendanceClient'

export const dynamic = 'force-dynamic'

export default async function TeacherAttendancePage() {
  const supabase = createClient()

  const [{ data: classes }, schoolEvents] = await Promise.all([
    supabase.from('sms_classes').select('id, name, grade_level').order('name'),
    getSchoolEventsByDate(supabase),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Attendance</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Select a class and date to mark or edit attendance.
        </p>
      </div>

      <Suspense fallback={null}>
        <AttendanceClient classes={classes ?? []} schoolEvents={schoolEvents} />
      </Suspense>
    </div>
  )
}
