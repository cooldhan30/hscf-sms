import Link from 'next/link'
import { FiBookOpen, FiFileText, FiAward, FiCheckSquare, FiSpeaker } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { RichTextContent } from '@/components/announcements/RichTextContent'

export const dynamic = 'force-dynamic'

export default async function StudentDashboardPage() {
  const supabase = createClient()

  const { userId } = await auth()

  const { data: student } = await supabase.from('sms_students').select('id').eq('profile_id', userId ?? '').single()
  const studentId = student?.id ?? ''

  const [{ data: classes }, { data: assignments }, { data: grades }, { data: attendance }, { data: announcements }] =
    await Promise.all([
      supabase.from('sms_classes').select('id, name'),
      supabase
        .from('sms_assignments')
        .select('*, class:sms_classes(id, name)')
        .gte('due_date', new Date().toISOString().slice(0, 10))
        .order('due_date', { ascending: true })
        .limit(5),
      supabase
        .from('sms_grades')
        .select('*, assignment:sms_assignments(title, max_score, class:sms_classes(name))')
        .eq('student_id', studentId)
        .not('score', 'is', null)
        .order('graded_at', { ascending: false })
        .limit(5),
      supabase.from('sms_attendance').select('status').eq('student_id', studentId),
      supabase.from('sms_announcements').select('*').order('created_at', { ascending: false }).limit(3),
    ])

  const attendanceRecords = attendance ?? []
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
          {!assignments || assignments.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">Nothing due soon.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-stone-800 dark:text-stone-100">{a.title}</p>
                    <p className="text-stone-500 dark:text-stone-400">{a.class.name}</p>
                  </div>
                  {a.due_date && <span className="text-stone-500 dark:text-stone-400">{new Date(a.due_date).toLocaleDateString()}</span>}
                </div>
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
