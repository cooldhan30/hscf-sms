import { sortByDueDate } from '@/lib/dates'

// Shared shape for the Class Progress view (student and teacher routes):
// per assignment, which students on the roster have submitted. Takes
// only submission timestamps -- never scores or submission content.

interface RosterStudent {
  id: string
  first_name: string
  last_name: string
}

interface ProgressAssignment {
  id: string
  title: string
  assignment_type: 'assignment' | 'exam'
  due_date: string | null
}

interface SubmissionStamp {
  assignment_id: string
  student_id: string
  submitted_at: string
}

export function buildClassProgress(
  students: RosterStudent[],
  assignments: ProgressAssignment[],
  submissions: SubmissionStamp[]
) {
  const rosterIds = new Set(students.map((s) => s.id))

  // Narrowed to exactly this class's roster -- sms_submissions has no
  // class_id column, so callers may pass rows for other classes too.
  const submittedByAssignment = new Map<string, Map<string, string>>()
  for (const s of submissions) {
    if (!rosterIds.has(s.student_id)) continue
    if (!submittedByAssignment.has(s.assignment_id)) submittedByAssignment.set(s.assignment_id, new Map())
    submittedByAssignment.get(s.assignment_id)!.set(s.student_id, s.submitted_at)
  }

  const sortedStudents = [...students].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))

  return sortByDueDate(assignments).map((a) => {
    const submittedMap = submittedByAssignment.get(a.id) ?? new Map<string, string>()
    return {
      assignmentId: a.id,
      title: a.title,
      assignmentType: a.assignment_type,
      dueDate: a.due_date,
      students: sortedStudents.map((s) => ({
        studentId: s.id,
        studentName: `${s.first_name} ${s.last_name}`.trim(),
        submitted: submittedMap.has(s.id),
        submittedAt: submittedMap.get(s.id) ?? null,
      })),
      submittedCount: submittedMap.size,
      totalCount: sortedStudents.length,
    }
  })
}
