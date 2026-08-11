import Link from 'next/link'
import { FiUsers, FiClock, FiFileText, FiClipboard, FiBookOpen } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { RichTextContent } from '@/components/announcements/RichTextContent'

export const dynamic = 'force-dynamic'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function TeacherDashboardPage() {
  const supabase = createClient()

  const { userId } = await auth()

  const todayName = WEEKDAYS[new Date().getDay()]

  const { data: classes } = await supabase
    .from('sms_classes')
    .select('*, enrollments:sms_class_enrollments(student_id)')
    // Filters the embedded rows only -- a class with nobody active still
    // appears, it just counts zero. Without this the student total keeps
    // counting a cohort that has already been promoted away.
    .eq('enrollments.status', 'active')
    .order('schedule_day')

  const allClasses = classes ?? []
  const todaysClasses = allClasses.filter((c) => (c.schedule_day ?? '').toLowerCase() === todayName.toLowerCase())
  const upcomingClasses = allClasses.filter((c) => (c.schedule_day ?? '').toLowerCase() !== todayName.toLowerCase())

  const totalStudents = new Set(allClasses.flatMap((c) => (c.enrollments ?? []).map((e: { student_id: string }) => e.student_id)))
    .size

  const classIds = allClasses.map((c) => c.id)

  let pendingGradingCount = 0
  if (classIds.length > 0) {
    const { data: assignments } = await supabase
      .from('sms_assignments')
      .select('id, class_id')
      .in('class_id', classIds)
      .eq('published', true)

    if (assignments && assignments.length > 0) {
      const enrollmentCounts = new Map<string, number>()
      for (const c of allClasses) enrollmentCounts.set(c.id, (c.enrollments ?? []).length)

      const { data: grades } = await supabase
        .from('sms_grades')
        .select('assignment_id')
        .in('assignment_id', assignments.map((a) => a.id))
        .not('score', 'is', null)

      const gradedCounts = new Map<string, number>()
      for (const g of grades ?? []) {
        gradedCounts.set(g.assignment_id, (gradedCounts.get(g.assignment_id) ?? 0) + 1)
      }

      pendingGradingCount = assignments.filter((a) => {
        const enrolled = enrollmentCounts.get(a.class_id) ?? 0
        const graded = gradedCounts.get(a.id) ?? 0
        return graded < enrolled
      }).length
    }
  }

  const { data: recentAnnouncements } = await supabase
    .from('sms_announcements')
    .select('*')
    .eq('created_by', userId ?? '')
    .order('created_at', { ascending: false })
    .limit(5)

  const stats = [
    { label: "Today's Classes", value: todaysClasses.length, icon: FiClock },
    { label: 'Total Students', value: totalStudents, icon: FiUsers },
    { label: 'Assignments to Grade', value: pendingGradingCount, icon: FiFileText, highlight: pendingGradingCount > 0 },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Teacher Dashboard</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Your classes, attendance, and gradebook.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`p-5 rounded-2xl border ${
              s.highlight
                ? 'border-terracotta-300 dark:border-terracotta-800 bg-terracotta-50 dark:bg-terracotta-950/30'
                : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900'
            }`}
          >
            <s.icon
              className={`w-5 h-5 mb-3 ${
                s.highlight ? 'text-terracotta-600 dark:text-terracotta-400' : 'text-primary-700 dark:text-primary-400'
              }`}
            />
            <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{s.value}</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
          <h2 className="text-lg font-bold text-primary-900 dark:text-white mb-4">Today&apos;s Classes</h2>
          {todaysClasses.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">No classes scheduled today.</p>
          ) : (
            <div className="space-y-2">
              {todaysClasses.map((c) => (
                <Link
                  key={c.id}
                  href={`/teacher/classes/${c.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors"
                >
                  <span className="font-medium text-stone-800 dark:text-stone-100">{c.name}</span>
                  <span className="text-sm text-stone-500 dark:text-stone-400">{c.start_time}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
          <h2 className="text-lg font-bold text-primary-900 dark:text-white mb-4">Upcoming Classes</h2>
          {upcomingClasses.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">Nothing else on your schedule.</p>
          ) : (
            <div className="space-y-2">
              {upcomingClasses.map((c) => (
                <Link
                  key={c.id}
                  href={`/teacher/classes/${c.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors"
                >
                  <span className="font-medium text-stone-800 dark:text-stone-100">{c.name}</span>
                  <span className="text-sm text-stone-500 dark:text-stone-400">
                    {c.schedule_day} {c.start_time}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary-900 dark:text-white flex items-center gap-2">
            <FiClipboard className="w-5 h-5" /> Recent Announcements
          </h2>
          <Link href="/teacher/announcements" className="text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline">
            View all
          </Link>
        </div>
        {!recentAnnouncements || recentAnnouncements.length === 0 ? (
          <EmptyState icon={FiBookOpen} title="No announcements posted yet" />
        ) : (
          <div className="space-y-3">
            {recentAnnouncements.map((a) => (
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
