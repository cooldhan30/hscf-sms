import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FiArrowLeft, FiUser, FiClock, FiMapPin } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import type { SmsClass, SmsTeacher, SmsProfile } from '@/types/database'

type ClassWithTeacher = SmsClass & { teacher: (SmsTeacher & { profile: SmsProfile }) | null }

export const dynamic = 'force-dynamic'

export default async function ParentChildDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  // RLS ("students: parent read own children") scopes this to the
  // signed-in parent's own linked children -- another parent's child
  // simply won't be found here, never a leaked read.
  const { data: student } = await supabase.from('sms_students').select('*').eq('id', params.id).single()
  if (!student) notFound()

  const { data: enrollments } = await supabase
    .from('sms_class_enrollments')
    .select('status, class:sms_classes(*, teacher:sms_teachers(*, profile:sms_profiles(*)))')
    .eq('student_id', params.id)
    .returns<{ status: string; class: ClassWithTeacher }[]>()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/parent/children"
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-300"
      >
        <FiArrowLeft className="w-4 h-4" /> Back to My Children
      </Link>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">
          {student.first_name} {student.last_name}
        </h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-stone-600 dark:text-stone-300">
          <span>{GRADE_LEVEL_OPTIONS.find((g) => g.value === student.grade_level)?.label || student.grade_level || '—'}</span>
          <span>Academic Year: {student.academic_year}</span>
          <span className="capitalize">Status: {student.enrollment_status}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <h2 className="text-lg font-bold text-primary-900 dark:text-white mb-4">Class & Schedule</h2>
        {enrollments && enrollments.length > 0 ? (
          <div className="space-y-4">
            {enrollments.map((e, i) => (
              <div key={i} className="p-4 rounded-xl border border-stone-100 dark:border-stone-800">
                <p className="font-semibold text-stone-800 dark:text-stone-100">{e.class.name}</p>
                <div className="space-y-1.5 mt-2 text-sm text-stone-600 dark:text-stone-300">
                  <p className="flex items-center gap-2">
                    <FiUser className="w-4 h-4 flex-shrink-0" />
                    {e.class.teacher ? `${e.class.teacher.profile.first_name} ${e.class.teacher.profile.last_name}` : 'Unassigned'}
                  </p>
                  {(e.class.schedule_day || e.class.start_time) && (
                    <p className="flex items-center gap-2">
                      <FiClock className="w-4 h-4 flex-shrink-0" />
                      {e.class.schedule_day} {e.class.start_time}
                      {e.class.end_time ? ` - ${e.class.end_time}` : ''}
                    </p>
                  )}
                  {e.class.room && (
                    <p className="flex items-center gap-2">
                      <FiMapPin className="w-4 h-4 flex-shrink-0" />
                      {e.class.room}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Not enrolled in any class yet" />
        )}
      </div>
    </div>
  )
}
