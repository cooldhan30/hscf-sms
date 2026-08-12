import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { FiCalendar } from 'react-icons/fi'
import { AttendanceRecordView } from '@/components/attendance/AttendanceRecordView'

export const dynamic = 'force-dynamic'

export default async function StudentAttendancePage() {
  const supabase = createClient()

  const { userId } = await auth()

  const { data: student } = await supabase.from('sms_students').select('id').eq('profile_id', userId ?? '').single()

  // RLS ("attendance: student read own") already scopes this to the
  // signed-in student's own attendance records only.
  const { data: records } = await supabase
    .from('sms_attendance')
    .select('*, class:sms_classes!inner(id, name)')
    .eq('student_id', student?.id ?? '')
    .order('date', { ascending: false })

  const all = records ?? []
  const total = all.length
  const presentCount = all.filter((r) => r.status === 'present').length
  const overallPctLabel = total > 0 ? `${((presentCount / total) * 100).toFixed(1)}%` : '—'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Attendance</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Your attendance history and overall rate.</p>
      </div>

      <div className="p-6 rounded-2xl border border-primary-200 dark:border-primary-900 bg-primary-50 dark:bg-primary-950/30">
        <p className="text-4xl font-bold text-primary-800 dark:text-primary-300">{overallPctLabel}</p>
        <p className="text-sm text-primary-700 dark:text-primary-400 mt-1">Overall attendance rate ({presentCount} of {total} days present)</p>
      </div>

      {total === 0 ? <EmptyState icon={FiCalendar} title="No attendance records yet" /> : <AttendanceRecordView records={all} />}
    </div>
  )
}
