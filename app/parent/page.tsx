import Link from 'next/link'
import { FiUsers, FiSpeaker, FiCalendar } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { RichTextContent } from '@/components/announcements/RichTextContent'
import { formatDateOnly } from '@/lib/dates'
import type { ChildOption } from './child-utils'

export const dynamic = 'force-dynamic'

export default async function ParentDashboardPage() {
  const supabase = createClient()

  const { userId } = await auth()

  const { data: parent } = await supabase.from('sms_parents').select('id').eq('profile_id', userId ?? '').single()

  const { data: links } = await supabase
    .from('sms_student_parents')
    .select('student:sms_students(id, first_name, last_name)')
    .eq('parent_id', parent?.id ?? '')
    .returns<{ student: ChildOption }[]>()

  const children = (links ?? []).map((l) => l.student)

  // These three are independent of each other -- run them concurrently
  // instead of one after another.
  const [childSummaries, { data: upcomingAssignments }, { data: announcements }] = await Promise.all([
    Promise.all(
      children.map(async (child) => {
        const [{ data: attendance }, { data: grades }] = await Promise.all([
          supabase.from('sms_attendance').select('status').eq('student_id', child.id),
          supabase
            .from('sms_grades')
            .select('score, assignment:sms_assignments!inner(max_score)')
            .eq('student_id', child.id)
            .not('score', 'is', null)
            .returns<{ score: number; assignment: { max_score: number } }[]>(),
        ])

        // A day marked 'holiday' still counts as a held class day, and
        // counts toward the student the same as 'present' -- marking a
        // day holiday never hurts anyone's attendance rate. Attending
        // remotely also counts as full attendance credit, same as being
        // physically present.
        const schoolDayAttendance = attendance ?? []
        const attTotal = schoolDayAttendance.length
        const attPresent = schoolDayAttendance.filter(
          (r) => r.status === 'present' || r.status === 'online' || r.status === 'holiday'
        ).length
        const attendancePct = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : null

        const gradeList = grades ?? []
        const gradeAvg =
          gradeList.length > 0
            ? Math.round(
                gradeList.reduce((sum, g) => sum + (g.score / g.assignment.max_score) * 100, 0) / gradeList.length
              )
            : null

        return { child, attendancePct, gradeAvg }
      })
    ),
    supabase
      .from('sms_assignments')
      .select('*, class:sms_classes!inner(id, name)')
      .gte('due_date', new Date().toISOString().slice(0, 10))
      .order('due_date', { ascending: true })
      .limit(5),
    supabase.from('sms_announcements').select('*').order('created_at', { ascending: false }).limit(3),
  ])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Parent Dashboard</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Track your children&apos;s progress.</p>
      </div>

      {children.length === 0 ? (
        <EmptyState
          icon={FiUsers}
          title="No children linked yet"
          description="Once the school links your account to your child's student record, their grades and attendance will appear here."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {childSummaries.map(({ child, attendancePct, gradeAvg }) => (
              <Link
                key={child.id}
                href={`/parent/children/${child.id}`}
                className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-primary-300 dark:hover:border-primary-800 transition-colors"
              >
                <h2 className="font-bold text-stone-800 dark:text-stone-100">
                  {child.first_name} {child.last_name}
                </h2>
                <div className="flex gap-6 mt-3 text-sm">
                  <div>
                    <p className="text-stone-400 dark:text-stone-500">Attendance</p>
                    <p className="font-semibold text-stone-800 dark:text-stone-100">
                      {attendancePct !== null ? `${attendancePct}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-400 dark:text-stone-500">Grade Average</p>
                    <p className="font-semibold text-stone-800 dark:text-stone-100">
                      {gradeAvg !== null ? `${gradeAvg}%` : '—'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-primary-900 dark:text-white flex items-center gap-2">
                <FiCalendar className="w-5 h-5" /> Upcoming Assignments
              </h2>
              <Link href="/parent/assignments" className="text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline">
                View all
              </Link>
            </div>
            {!upcomingAssignments || upcomingAssignments.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">Nothing due soon.</p>
            ) : (
              <div className="space-y-2">
                {upcomingAssignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-stone-800 dark:text-stone-100">{a.title}</p>
                      <p className="text-stone-500 dark:text-stone-400">{a.class.name}</p>
                    </div>
                    {a.due_date && <span className="text-stone-500 dark:text-stone-400">{formatDateOnly(a.due_date)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-primary-900 dark:text-white flex items-center gap-2">
                <FiSpeaker className="w-5 h-5" /> School Announcements
              </h2>
              <Link href="/parent/announcements" className="text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline">
                View all
              </Link>
            </div>
            {!announcements || announcements.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">No announcements yet.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="text-sm">
                    <p className="font-semibold text-stone-800 dark:text-stone-100">{a.title}</p>
                    <RichTextContent html={a.body} className="text-stone-500 dark:text-stone-400 line-clamp-2" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
