import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FiArrowLeft } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { JoinCodeBadge } from '@/components/classes/JoinCodeBadge'
import { RosterClient, type EnrollmentRow } from './RosterClient'
import { PendingTeacherRequests, type TeacherRequestRow } from './PendingTeacherRequests'
import { HeadTeacherPicker, type ClassTeacherOption } from './HeadTeacherPicker'

// A class can be co-taught. Teachers get here only by entering the join
// code and being approved -- this is display, not assignment.
type ClassTeacherRow = {
  is_primary: boolean
  teacher: { id: string; profile: { first_name: string; last_name: string; is_active: boolean } | null } | null
}

export const dynamic = 'force-dynamic'

export default async function ClassRosterPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: cls } = await supabase
    .from('sms_classes')
    .select('*, teacher:sms_teachers!sms_classes_teacher_id_fkey(*, profile:sms_profiles(*))')
    .eq('id', params.id)
    .single()

  if (!cls) notFound()

  const [
    { data: enrollments },
    { data: allStudents },
    { data: teacherRequests },
    { data: classTeachers },
  ] = await Promise.all([
    supabase
      .from('sms_class_enrollments')
      .select('status, enrolled_at, student:sms_students(*)')
      .eq('class_id', params.id)
      // A promoted cohort has moved on to next year's class and is no
      // longer on this roster. 'dropped' still shows, with its label --
      // that's a student who left, which an admin does want to see here.
      .neq('status', 'promoted')
      .returns<EnrollmentRow[]>(),
    supabase.from('sms_students').select('*').order('first_name'),
    supabase
      .from('sms_class_teacher_requests')
      .select('id, requested_at, teacher:sms_teachers(profile:sms_profiles(*))')
      .eq('class_id', params.id)
      .eq('status', 'pending')
      .returns<TeacherRequestRow[]>(),
    supabase
      .from('sms_class_teachers')
      .select('is_primary, teacher:sms_teachers(id, profile:sms_profiles(first_name, last_name, is_active))')
      .eq('class_id', params.id)
      // Lead first, then in the order they were approved.
      .order('is_primary', { ascending: false })
      .order('assigned_at')
      .returns<ClassTeacherRow[]>(),
  ])

  // A disabled teacher keeps their membership row (history stays intact)
  // but shouldn't still read as "the teacher of this class" to admins.
  const activeClassTeachers = (classTeachers ?? []).filter((t) => t.teacher?.profile?.is_active)

  const membershipNames = activeClassTeachers
    .map((t) => (t.teacher?.profile ? `${t.teacher.profile.first_name} ${t.teacher.profile.last_name}`.trim() : null))
    .filter((n): n is string => Boolean(n))

  // Fall back to the teacher recorded on the class itself when the
  // membership table returns nothing -- it does not exist until 036 is
  // applied, and a class that plainly has a teacher must never be shown
  // as "Unassigned" just because a newer query came back empty.
  const leadName = cls.teacher?.profile?.is_active
    ? `${cls.teacher.profile.first_name} ${cls.teacher.profile.last_name}`.trim()
    : null

  const teacherNames = membershipNames.length > 0 ? membershipNames : leadName ? [leadName] : []

  const headTeacherOptions: ClassTeacherOption[] = activeClassTeachers
    .filter((t) => t.teacher)
    .map((t) => ({
      teacherId: t.teacher!.id,
      name: `${t.teacher!.profile!.first_name} ${t.teacher!.profile!.last_name}`.trim(),
      isPrimary: t.is_primary,
    }))

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
          {/* Every approved teacher, not just the lead -- a co-taught
              class showing one name misrepresents who can act on it. */}
          <span>
            {teacherNames.length > 1 ? 'Teachers: ' : 'Teacher: '}
            {teacherNames.length > 0 ? teacherNames.join(', ') : 'Unassigned'}
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

      <HeadTeacherPicker classId={cls.id} teachers={headTeacherOptions} />

      <RosterClient classId={cls.id} initialEnrollments={enrollments ?? []} allStudents={allStudents ?? []} />
    </div>
  )
}
