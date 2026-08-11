import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FiArrowLeft, FiCheckSquare, FiFileText, FiAward } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import { JoinCodeBadge } from '@/components/classes/JoinCodeBadge'
import { PendingJoinRequests, type JoinRequestRow } from './PendingJoinRequests'
import { RosterList, type RosterRow } from './RosterList'

export const dynamic = 'force-dynamic'

export default async function TeacherClassDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  // RLS scopes this to the teacher's own class -- a student from another
  // teacher's class simply won't be found (404), never a leaked read.
  const { data: cls } = await supabase.from('sms_classes').select('*').eq('id', params.id).single()

  if (!cls) notFound()

  const [{ data: enrollments }, { data: joinRequests }] = await Promise.all([
    supabase
      .from('sms_class_enrollments')
      .select('status, student:sms_students(*)')
      .eq('class_id', params.id)
      .neq('status', 'promoted')
      .returns<RosterRow[]>(),
    supabase
      .from('sms_class_join_requests')
      .select('id, requested_at, student:sms_students(first_name, last_name)')
      .eq('class_id', params.id)
      .eq('status', 'pending')
      .returns<JoinRequestRow[]>(),
  ])

  const quickLinks = [
    { label: 'Attendance', href: `/teacher/attendance?classId=${cls.id}`, icon: FiCheckSquare },
    { label: 'Assignments', href: `/teacher/assignments?classId=${cls.id}`, icon: FiFileText },
    { label: 'Gradebook', href: `/teacher/gradebook?classId=${cls.id}`, icon: FiAward },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/teacher/classes"
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-300"
      >
        <FiArrowLeft className="w-4 h-4" /> Back to My Classes
      </Link>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">{cls.name}</h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-stone-600 dark:text-stone-300">
          <span>{GRADE_LEVEL_OPTIONS.find((g) => g.value === cls.grade_level)?.label || cls.grade_level || 'No grade level'}</span>
          {(cls.schedule_day || cls.start_time) && (
            <span>
              Schedule: {cls.schedule_day} {cls.start_time}
              {cls.end_time ? ` - ${cls.end_time}` : ''}
            </span>
          )}
          {cls.room && <span>Room: {cls.room}</span>}
          <span>Academic Year: {cls.academic_year}</span>
          {cls.join_code && (
            <span className="flex items-center gap-2">
              Join code: <JoinCodeBadge code={cls.join_code} />
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-primary-300 dark:hover:border-primary-800 transition-colors text-center"
          >
            <link.icon className="w-5 h-5 text-primary-700 dark:text-primary-400" />
            <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">{link.label}</span>
          </Link>
        ))}
      </div>

      <PendingJoinRequests classId={cls.id} requests={joinRequests ?? []} />

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <h2 className="text-lg font-bold text-primary-900 dark:text-white mb-4">Student Roster</h2>
        <RosterList classId={cls.id} enrollments={enrollments ?? []} />
      </div>
    </div>
  )
}
