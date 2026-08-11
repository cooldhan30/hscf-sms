// Display-only late-penalty preview. sms_grades.score is always entered
// by the teacher by hand (see 015_assignment_submissions.sql) -- this
// mirrors that formula purely so students/teachers can see what an
// overdue assignment is currently worth, it does not enforce anything.
export function previewMaxPoints({
  maxScore,
  deductionPerDay,
  dueDate,
  now = new Date(),
}: {
  maxScore: number
  deductionPerDay: number
  dueDate: string | null
  now?: Date
}): number {
  if (!dueDate || deductionPerDay <= 0) return maxScore
  const due = new Date(dueDate)
  if (now <= due) return maxScore
  const daysLate = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  const decayed = maxScore - daysLate * deductionPerDay
  return Math.max(0, decayed)
}
