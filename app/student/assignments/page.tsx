import Link from 'next/link'
import { FiCalendar, FiCheckCircle, FiUpload } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { previewMaxPoints } from '@/lib/points'
import { isPastDueDate, formatDateOnly, sortByDueDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export default async function StudentAssignmentsPage() {
  const supabase = createClient()

  const { userId } = await auth()

  const { data: student } = await supabase.from('sms_students').select('id').eq('profile_id', userId ?? '').single()

  // RLS ("assignments: student read published in own class") already
  // scopes this to published assignments in classes the student is
  // enrolled in.
  const { data: assignmentRows } = await supabase
    .from('sms_assignments')
    .select('*, class:sms_classes!inner(id, name)')
  const assignments = sortByDueDate(assignmentRows ?? [])

  const [{ data: myGrades }, { data: mySubmissions }] = await Promise.all([
    supabase.from('sms_grades').select('assignment_id, score, feedback').eq('student_id', student?.id ?? ''),
    supabase.from('sms_submissions').select('assignment_id, submitted_at').eq('student_id', student?.id ?? ''),
  ])

  const gradeByAssignment = new Map((myGrades ?? []).map((g) => [g.assignment_id, g]))
  const submissionByAssignment = new Map((mySubmissions ?? []).map((s) => [s.assignment_id, s]))
  const now = new Date()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Assignments</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Your assignments across all classes.</p>
      </div>

      {!assignments || assignments.length === 0 ? (
        <EmptyState title="No assignments yet" />
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const grade = gradeByAssignment.get(a.id)
            const isGraded = grade && grade.score !== null && grade.score !== undefined
            const submission = submissionByAssignment.get(a.id)
            const isOverdue = a.due_date ? isPastDueDate(a.due_date, now) : false
            const decayedMax =
              isOverdue && !submission && a.points_deduction_per_day > 0
                ? previewMaxPoints({
                    maxScore: a.max_score,
                    deductionPerDay: a.points_deduction_per_day,
                    dueDate: a.due_date,
                    now,
                  })
                : null
            return (
              <div key={a.id} className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-600 dark:text-terracotta-400">
                      {a.class.name}
                    </p>
                    <h2 className="font-bold text-stone-800 dark:text-stone-100 mt-0.5">{a.title}</h2>
                    {a.description && <p className="text-sm text-stone-600 dark:text-stone-300 mt-1">{a.description}</p>}
                    {a.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element -- teacher-uploaded Storage URL
                      <img src={a.image_url} alt="" className="max-h-40 rounded-xl border border-stone-200 dark:border-stone-800 mt-2" />
                    )}
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-stone-500 dark:text-stone-400">
                      {a.due_date && (
                        <span className="flex items-center gap-1.5">
                          <FiCalendar className="w-3.5 h-3.5" /> Due {formatDateOnly(a.due_date)}
                        </span>
                      )}
                      <span>Out of {a.max_score}</span>
                    </div>
                    {decayedMax !== null && (
                      <p className="text-sm font-semibold text-terracotta-600 dark:text-terracotta-400 mt-1.5">
                        Submit now: max {decayedMax}/{a.max_score} pts (late penalty applied)
                      </p>
                    )}
                    <Link
                      href={`/student/assignments/${a.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 mt-2 hover:underline"
                    >
                      <FiUpload className="w-3.5 h-3.5" /> {submission ? 'View / resubmit' : 'Submit work'}
                    </Link>
                  </div>
                  {isGraded ? (
                    <div className="flex-shrink-0 text-right">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300">
                        <FiCheckCircle className="w-4 h-4" />
                        {grade.score}/{a.max_score}
                      </span>
                      {grade.feedback && (
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 max-w-[180px]">{grade.feedback}</p>
                      )}
                    </div>
                  ) : submission ? (
                    <span className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300">
                      Submitted
                    </span>
                  ) : (
                    <span className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                      Not submitted
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
