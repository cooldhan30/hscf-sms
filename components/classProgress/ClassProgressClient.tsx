'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiCheckCircle, FiCircle } from 'react-icons/fi'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { formatDateOnly } from '@/lib/dates'

interface ClassOption {
  id: string
  name: string
}

interface StudentProgress {
  studentId: string
  studentName: string
  submitted: boolean
  submittedAt: string | null
}

interface AssignmentProgress {
  assignmentId: string
  title: string
  assignmentType: 'assignment' | 'exam'
  dueDate: string | null
  students: StudentProgress[]
  submittedCount: number
  totalCount: number
}

// Class-wide submission progress -- who's turned in each assignment,
// who hasn't. Deliberately NEVER fetches or displays sms_grades: for
// students it's a peer-motivation view, not a way to see classmates'
// scores; for teachers it's a who-to-remind list (scores live in the
// gradebook). Both API routes (app/api/{student,teacher}/class-progress)
// enforce that boundary server-side.
export function ClassProgressClient({
  classes,
  apiPath = '/api/student/class-progress',
}: {
  classes: ClassOption[]
  apiPath?: string
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [assignments, setAssignments] = useState<AssignmentProgress[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!classId) {
      setAssignments([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`${apiPath}?classId=${classId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
          setAssignments([])
          return
        }
        setAssignments(data.assignments ?? [])
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load class progress')
          setAssignments([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [classId, apiPath])

  const sortedClasses = useMemo(() => classes, [classes])

  if (sortedClasses.length === 0) {
    return <EmptyState title="No classes yet" />
  }

  return (
    <div className="space-y-4">
      <select
        value={classId}
        onChange={(e) => setClassId(e.target.value)}
        className="w-full sm:w-auto px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
      >
        {sortedClasses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading || assignments === null ? (
        <p className="text-sm text-stone-400 dark:text-stone-500">Loading...</p>
      ) : assignments.length === 0 ? (
        <EmptyState title="No assignments yet for this class" />
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => (
            <AssignmentProgressCard key={a.assignmentId} assignment={a} />
          ))}
        </div>
      )}
    </div>
  )
}

function AssignmentProgressCard({ assignment }: { assignment: AssignmentProgress }) {
  const [expanded, setExpanded] = useState(false)
  const pct = assignment.totalCount > 0 ? Math.round((assignment.submittedCount / assignment.totalCount) * 100) : 0

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide mb-1 ${
              assignment.assignmentType === 'exam'
                ? 'bg-gold-100 text-gold-800 dark:bg-gold-950 dark:text-gold-300'
                : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
            }`}
          >
            {assignment.assignmentType === 'exam' ? 'Exam' : 'Assignment'}
          </span>
          <h3 className="font-bold text-stone-800 dark:text-stone-100">{assignment.title}</h3>
          {assignment.dueDate && (
            <p className="text-sm text-stone-500 dark:text-stone-400">Due {formatDateOnly(assignment.dueDate)}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-primary-700 dark:text-primary-400">
            {assignment.submittedCount}/{assignment.totalCount}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">submitted</p>
        </div>
      </div>

      <div className="mt-3 h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
        <div className="h-full bg-primary-600 dark:bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-3 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline"
      >
        {expanded ? 'Hide details' : 'Show who has and hasn’t submitted'}
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {assignment.students.map((s) => (
            <div key={s.studentId} className="flex items-center gap-2 text-sm">
              {s.submitted ? (
                <FiCheckCircle className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
              ) : (
                <FiCircle className="w-4 h-4 text-stone-300 dark:text-stone-600 flex-shrink-0" />
              )}
              <span className={s.submitted ? 'text-stone-700 dark:text-stone-200' : 'text-stone-400 dark:text-stone-500'}>
                {s.studentName}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
