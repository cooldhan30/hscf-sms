import Link from 'next/link'
import { FiBookOpen, FiFileText, FiAward, FiCheckSquare, FiSpeaker } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { RichTextContent } from '@/components/announcements/RichTextContent'
import { TheniJoinBanner } from '@/components/theni/TheniJoinBanner'
import { formatDateOnly } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export default async function StudentDashboardPage() {
  const supabase = createClient()

  const { userId } = await auth()

  const { data: student } = await supabase.from('sms_students').select('id').eq('profile_id', userId ?? '').single()
  const studentId = student?.id ?? ''

  const [{ data: classes }, { data: allAssignments }, { data: mySubmissions }, { data: grades }, { data: attendance }, { data: announcements }, { data: theniEnrollment }] =
    await Promise.all([
      supabase.from('sms_classes').select('id, name'),
      // RLS ("assignments: student read published in own class") already
      // scopes this to published assignments in the student's own
      // classes -- see app/student/assignments/page.tsx for the same
      // pattern. No due_date filter here: an assignment that's already
      // overdue is still "not submitted" and needs to keep showing up,
      // not silently disappear the day after it was due.
      supabase
        .from('sms_assignments')
        .select('*, class:sms_classes!inner(id, name)')
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('sms_submissions').select('assignment_id').eq('student_id', studentId),
      supabase
        .from('sms_grades')
        .select('*, assignment:sms_assignments!inner(title, max_score, class:sms_classes!inner(name))')
        .eq('student_id', studentId)
        .not('score', 'is', null)
        .order('graded_at', { ascending: false })
        .limit(5),
      supabase.from('sms_attendance').select('status').eq('student_id', studentId),
      supabase.from('sms_announcements').select('*').order('created_at', { ascending: false }).limit(3),
      supabase.from('sms_theni_enrollments').select('id').eq('student_id', studentId).limit(1).maybeSingle(),
    ])

  // "Upcoming Assignments" here really means "still needs action" --
  // anything not yet submitted, whether its due date is in the future or
  // already past. Capped to 5 for the dashboard preview; the full list
  // (with overdue/late-penalty detail) lives at /student/assignments.
  const submittedIds = new Set((mySubmissions ?? []).map((s) => s.assignment_id))
  const assignments = (allAssignments ?? []).filter((a) => !submittedIds.has(a.id)).slice(0, 5)

  // Holidays aren't school days the student could attend or miss, so
  // they're excluded from the attendance-rate denominator entirely --
  // marking a day 'holiday' never affects this rate.
  const attendanceRecords = (attendance ?? []).filter((r) => r.status !== 'holiday')
  const attendancePct =
    attendanceRecords.length > 0
      ? ((attendanceRecords.filter((r) => r.status === 'present').length / attendanceRecords.length) * 100).toFixed(1)
      : null

  const stats = [
    { label: 'Current Classes', value: classes?.length ?? 0, icon: FiBookOpen },
    { label: 'Upcoming Assignments', value: assignments?.length ?? 0, icon: FiFileText },
    { label: 'Attendance Rate', value: attendancePct !== null ? `${attendancePct}%` : '—', icon: FiCheckSquare },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">My Dashboard</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Your classes, grades, and attendance.</p>
      </div>

      {!theniEnrollment && <TheniJoinBanner />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <s.icon className="w-5 h-5 mb-3 text-primary-700 dark:text-primary-400" />
            <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{s.value}</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-primary-900 dark:text-white">Upcoming Assignments</h2>
            <Link href="/student/assignments" className="text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline">
              View all
            </Link>
          </div>
          {assignments.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">Nothing left to submit.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/student/assignments/${a.id}`}
                  className="flex items-center justify-between text-sm -mx-2 px-2 py-1 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors"
                >
                  <div>
                    <p className="font-medium text-stone-800 dark:text-stone-100">{a.title}</p>
                    <p className="text-stone-500 dark:text-stone-400">{a.class.name}</p>
                  </div>
                  {a.due_date && <span className="text-stone-500 dark:text-stone-400">{formatDateOnly(a.due_date)}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-primary-900 dark:text-white">Recent Grades</h2>
            <Link href="/student/grades" className="text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline">
              View all
            </Link>
          </div>
          {!grades || grades.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">No graded assignments yet.</p>
          ) : (
            <div className="space-y-2">
              {grades.map((g) => (
                <div key={g.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-stone-800 dark:text-stone-100">{g.assignment.title}</p>
                    <p className="text-stone-500 dark:text-stone-400">{g.assignment.class.name}</p>
                  </div>
                  <span className="font-semibold text-primary-700 dark:text-primary-400">
                    {g.score}/{g.assignment.max_score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary-900 dark:text-white flex items-center gap-2">
            <FiSpeaker className="w-5 h-5" /> School Announcements
          </h2>
          <Link href="/student/announcements" className="text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline">
            View all
          </Link>
        </div>
        {!announcements || announcements.length === 0 ? (
          <EmptyState icon={FiAward} title="No announcements yet" />
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
    </div>
  )
}
