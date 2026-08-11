import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FiArrowLeft } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { JoinCodeBadge } from '@/components/classes/JoinCodeBadge'
import { RosterClient, type EnrollmentRow } from './RosterClient'
import { PendingTeacherRequests, type TeacherRequestRow } from './PendingTeacherRequests'

export const dynamic = 'force-dynamic'

export default async function ClassRosterPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: cls } = await supabase
    .from('sms_classes')
    .select('*, teacher:sms_teachers(*, profile:sms_profiles(*))')
    .eq('id', params.id)
    .single()

  if (!cls) notFound()

  const [{ data: enrollments }, { data: allStudents }, { data: teacherRequests }] = await Promise.all([
    supabase
      .from('sms_class_enrollments')
      .select('status, enrolled_at, student:sms_students(*)')
      .eq('class_id', params.id)
      .returns<EnrollmentRow[]>(),
    supabase.from('sms_students').select('*').order('first_name'),
    supabase
      .from('sms_class_teacher_requests')
      .select('id, requested_at, teacher:sms_teachers(profile:sms_profiles(*))')
      .eq('class_id', params.id)
      .eq('status', 'pending')
      .returns<TeacherRequestRow[]>(),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/admin/classes"
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-300"
      >
        <FiArrowLeft className="w-4 h-4" /> Back to Classes
      </Link>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">{cls.name}</h1>
        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-stone-600 dark:text-stone-300">
          <span>
            Teacher: {cls.teacher ? `${cls.teacher.profile.first_name} ${cls.teacher.profile.last_name}` : 'Unassigned'}
          </span>
          {(cls.schedule_day || cls.start_time) && (
            <span>
              Schedule: {cls.schedule_day} {cls.start_time}
              {cls.end_time ? ` - ${cls.end_time}` : ''}
            </span>
          )}
          {cls.room && <span>Room: {cls.room}</span>}
          {cls.join_code && (
            <span className="flex items-center gap-2">
              Join code: <JoinCodeBadge code={cls.join_code} />
            </span>
          )}
        </div>
      </div>

      <PendingTeacherRequests classId={cls.id} requests={teacherRequests ?? []} />

      <RosterClient classId={cls.id} initialEnrollments={enrollments ?? []} allStudents={allStudents ?? []} />
    </div>
  )
}
