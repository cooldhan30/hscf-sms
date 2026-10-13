import { notFound } from 'next/navigation'
import { AssignmentReview } from '@/components/grClassic/student/AssignmentReview'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcStudentPage, studentReview } from '@/lib/grClassic/server/studentAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// A student reviews their own submitted assignment.
export default async function GrClassicAssignmentReviewPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound()
  const s = await grcStudentPage(`/gr-classic/student/assignments/${params.id}`)
  if (!s.ok) return <TeachersOnly who="students" message={s.error} />
  const a = await studentReview(s.admin, s.studentId, params.id)
  if (!a || !a.submittedAt) notFound()
  return <AssignmentReview a={a} />
}
