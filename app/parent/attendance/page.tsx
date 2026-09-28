import { Suspense } from 'react'
import { FiCalendar } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { ChildSelector } from '../ChildSelector'
import { resolveSelectedChildId, type ChildOption } from '../child-utils'
import { AttendanceRecordView } from '@/components/attendance/AttendanceRecordView'
import { todayISODate } from '@/lib/dates'
import { getSchoolEventsByDate } from '@/lib/schoolCalendar'

export const dynamic = 'force-dynamic'

export default async function ParentAttendancePage({ searchParams }: { searchParams: { childId?: string } }) {
  const supabase = createClient()

  const { userId } = await auth()

  const { data: parent } = await supabase.from('sms_parents').select('id').eq('profile_id', userId ?? '').single()

  const { data: links } = await supabase
    .from('sms_student_parents')
    .select('student:sms_students(id, first_name, last_name)')
    .eq('parent_id', parent?.id ?? '')
    .returns<{ student: ChildOption }[]>()

  const children = (links ?? []).map((l) => l.student)
  const childId = resolveSelectedChildId(children, searchParams.childId)

  const { data: records } = childId
    ? await supabase
        .from('sms_attendance')
        .select('*, class:sms_classes!inner(id, name)')
        .eq('student_id', childId)
        .order('date', { ascending: false })
    : { data: [] }

  const all = records ?? []
  const schoolEvents = await getSchoolEventsByDate(supabase)
  // A day marked 'holiday' still counts as a held class day, and counts
  // toward the student the same as 'present' -- marking a day holiday
  // never hurts this percentage. Attending remotely also counts as full
  // attendance credit, same as being physically present.
  // Pre-marked future holidays show on the calendar but don't count yet
  const today = todayISODate()
  const counted = all.filter((r) => r.date <= today)
  const total = counted.length
  const presentCount = counted.filter((r) => r.status === 'present' || r.status === 'online' || r.status === 'holiday').length
  const overallPctLabel = total > 0 ? `${((presentCount / total) * 100).toFixed(1)}%` : '—'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Attendance</h1>
          <p className="text-stone-500 dark:text-stone-400 mt-1">Your child&apos;s attendance history.</p>
        </div>
        <Suspense fallback={null}>
          <ChildSelector options={children} />
        </Suspense>
      </div>

      {children.length === 0 ? (
        <EmptyState title="No children linked yet" />
      ) : (
        <>
          <div className="p-6 rounded-2xl border border-primary-200 dark:border-primary-900 bg-primary-50 dark:bg-primary-950/30">
            <p className="text-4xl font-bold text-primary-800 dark:text-primary-300">{overallPctLabel}</p>
            <p className="text-sm text-primary-700 dark:text-primary-400 mt-1">
              Overall attendance rate ({presentCount} of {total} days present)
            </p>
          </div>

          {all.length === 0 && Object.keys(schoolEvents).length === 0 ? <EmptyState icon={FiCalendar} title="No attendance records yet" /> : <AttendanceRecordView records={all} events={schoolEvents} />}
        </>
      )}
    </div>
  )
}
