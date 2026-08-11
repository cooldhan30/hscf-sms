import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FiArrowLeft, FiMail, FiPhone, FiUsers, FiBookOpen, FiCalendar, FiAward } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import { AttendanceCalendar, type AttendanceCellStatus } from '@/components/attendance/AttendanceCalendar'
import type { SmsClass, SmsParent } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function StudentProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: student } = await supabase
    .from('sms_students')
    .select('*, profile:sms_profiles(*)')
    .eq('id', params.id)
    .single()

  if (!student) notFound()

  const { data: parentLinks } = await supabase
    .from('sms_student_parents')
    .select('relationship, parent:sms_parents(*)')
    .eq('student_id', params.id)
    .returns<{ relationship: string | null; parent: SmsParent }[]>()

  const { data: enrollments } = await supabase
    .from('sms_class_enrollments')
    .select('status, class:sms_classes(*)')
    .eq('student_id', params.id)
    // Last year's class after a promotion is history, not somewhere the
    // student still sits.
    .neq('status', 'promoted')
    .returns<{ status: string; class: SmsClass }[]>()

  const { data: attendance } = await supabase
    .from('sms_attendance')
    .select('date, status')
    .eq('student_id', params.id)
    .returns<{ date: string; status: AttendanceCellStatus }[]>()

  const { data: grades } = await supabase
    .from('sms_grades')
    .select('score, feedback, assignment:sms_assignments(title, max_score, class:sms_classes(name))')
    .eq('student_id', params.id)
    .returns<{ score: number | null; feedback: string | null; assignment: { title: string; max_score: number; class: { name: string } } }[]>()

  const gradeLabel =
    GRADE_LEVEL_OPTIONS.find((g) => g.value === student.grade_level)?.label || student.grade_level || '—'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/admin/students"
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-300"
      >
        <FiArrowLeft className="w-4 h-4" /> Back to Students
      </Link>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">
          {student.first_name} {student.last_name}
        </h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-stone-600 dark:text-stone-300">
          <span>Grade: {gradeLabel}</span>
          <span>Academic Year: {student.academic_year}</span>
          <span className="capitalize">Status: {student.enrollment_status}</span>
        </div>
        {student.profile?.email && (
          <div className="flex items-center gap-2 mt-3 text-sm text-stone-500 dark:text-stone-400">
            <FiMail className="w-4 h-4" /> {student.profile.email}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary-900 dark:text-white mb-4">
          <FiUsers className="w-5 h-5" /> Parents / Guardians
        </h2>
        {parentLinks && parentLinks.length > 0 ? (
          <div className="space-y-3">
            {parentLinks.map((link, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="font-semibold text-stone-800 dark:text-stone-100">
                  {link.parent.first_name} {link.parent.last_name}
                </span>
                {link.parent.email && (
                  <span className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
                    <FiMail className="w-3.5 h-3.5" /> {link.parent.email}
                  </span>
                )}
                {link.parent.phone && (
                  <span className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
                    <FiPhone className="w-3.5 h-3.5" /> {link.parent.phone}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={FiUsers} title="No parents linked" description="Link a parent from the Students list." />
        )}
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary-900 dark:text-white mb-4">
          <FiBookOpen className="w-5 h-5" /> Class Enrollments
        </h2>
        {enrollments && enrollments.length > 0 ? (
          <div className="space-y-2">
            {enrollments.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-medium text-stone-800 dark:text-stone-100">{e.class.name}</span>
                <span className="capitalize text-stone-500 dark:text-stone-400">{e.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FiBookOpen}
            title="Not enrolled in any class"
            description="Enroll this student from the Classes page."
          />
        )}
      </div>

      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary-900 dark:text-white mb-4">
          <FiCalendar className="w-5 h-5" /> Attendance
        </h2>
        {attendance && attendance.length > 0 ? (
          <AttendanceCalendar
            dateStatus={Object.fromEntries(attendance.map((r) => [r.date, r.status]))}
          />
        ) : (
          <EmptyState icon={FiCalendar} title="No attendance records yet" />
        )}
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary-900 dark:text-white mb-4">
          <FiAward className="w-5 h-5" /> Grades
        </h2>
        {grades && grades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800">
                  <th className="text-left font-semibold text-stone-600 dark:text-stone-300 py-2 pr-4">Class</th>
                  <th className="text-left font-semibold text-stone-600 dark:text-stone-300 py-2 pr-4">Assignment</th>
                  <th className="text-left font-semibold text-stone-600 dark:text-stone-300 py-2 pr-4">Score</th>
                  <th className="text-left font-semibold text-stone-600 dark:text-stone-300 py-2">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g, i) => (
                  <tr key={i} className="border-b border-stone-100 dark:border-stone-800/60 last:border-0">
                    <td className="py-2.5 pr-4 text-stone-600 dark:text-stone-300">{g.assignment.class.name}</td>
                    <td className="py-2.5 pr-4 font-medium text-stone-800 dark:text-stone-100">{g.assignment.title}</td>
                    <td className="py-2.5 pr-4 font-semibold text-stone-800 dark:text-stone-100">
                      {g.score !== null ? `${g.score}/${g.assignment.max_score}` : '—'}
                    </td>
                    <td className="py-2.5 text-stone-500 dark:text-stone-400">{g.feedback || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={FiAward} title="No grades recorded yet" />
        )}
      </div>
    </div>
  )
}
