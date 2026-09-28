import { Suspense } from 'react'
import { FiCalendar, FiCheckCircle } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { ChildSelector } from '../ChildSelector'
import { resolveSelectedChildId, type ChildOption } from '../child-utils'
import { formatDateOnly, sortByDueDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export default async function ParentAssignmentsPage({ searchParams }: { searchParams: { childId?: string } }) {
  const supabase = createClient()

  const { userId } = await auth()

  const { data: parent } = await supabase.from('sms_parents').select('id').eq('profile_id', userId ?? '').single()

  const { data: links } = await supabase
    .from('sms_student_parents')
    .select('student:sms_students(id, first_name, last_name)')
    .eq('parent_id', parent?.id ?? '')
    .returns<{ student: ChildOption }[]>()

  const children = (links ?? []).map((l) => l.student)
  const childId = resolveSelectedChildId(children, searchParams.childId)

  const [{ data: assignments }, { data: grades }] = childId
    ? await Promise.all([
        supabase
          .from('sms_assignments')
          .select('*, class:sms_classes!inner(id, name)'),
        supabase.from('sms_grades').select('assignment_id, score, feedback').eq('student_id', childId),
      ])
    : [{ data: [] }, { data: [] }]

  const gradeByAssignment = new Map((grades ?? []).map((g) => [g.assignment_id, g]))
  const all = sortByDueDate(assignments ?? [])
  const completed = all.filter((a) => {
    const g = gradeByAssignment.get(a.id)
    return g && g.score !== null && g.score !== undefined
  })
  const upcoming = all.filter((a) => !completed.includes(a))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Assignments</h1>
          <p className="text-stone-500 dark:text-stone-400 mt-1">Upcoming and completed assignments.</p>
        </div>
        <Suspense fallback={null}>
          <ChildSelector options={children} />
        </Suspense>
      </div>

      {children.length === 0 ? (
        <EmptyState title="No children linked yet" />
      ) : (
        <>
          <div>
            <h2 className="text-lg font-bold text-primary-900 dark:text-white mb-3">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">Nothing pending.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((a) => (
                  <div key={a.id} className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-stone-800 dark:text-stone-100">{a.title}</p>
                      <p className="text-sm text-stone-500 dark:text-stone-400">{a.class.name}</p>
                    </div>
                    {a.due_date && (
                      <span className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
                        <FiCalendar className="w-3.5 h-3.5" /> {formatDateOnly(a.due_date)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-primary-900 dark:text-white mb-3">Completed</h2>
            {completed.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">No graded assignments yet.</p>
            ) : (
              <div className="space-y-2">
                {completed.map((a) => {
                  const g = gradeByAssignment.get(a.id)
                  return (
                    <div key={a.id} className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-stone-800 dark:text-stone-100">{a.title}</p>
                        <p className="text-sm text-stone-500 dark:text-stone-400">{a.class.name}</p>
                      </div>
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400">
                        <FiCheckCircle className="w-4 h-4" /> {g?.score}/{a.max_score}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
