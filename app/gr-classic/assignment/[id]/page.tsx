import { notFound } from 'next/navigation'
import { AssignmentRunner } from '@/components/grClassic/student/AssignmentRunner'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcStudentPage } from '@/lib/grClassic/server/studentAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// A student plays one of their assignments. Everything about the attempt
// (enrollment, attempts left, due date, timer) is checked by the server
// when the runner calls /api/gr-classic/assignments/<id>/start.
export default async function GrClassicAssignmentPlayPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound()
  const s = await grcStudentPage(`/gr-classic/assignment/${params.id}`)
  if (!s.ok) return <TeachersOnly who="students" message={s.error} />
  return <AssignmentRunner assignmentId={params.id} />
}
