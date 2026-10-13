import { AssignmentsBoard } from '@/components/grClassic/student/AssignmentsBoard'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcStudentPage, listStudentAssignments } from '@/lib/grClassic/server/studentAssignments'

export default async function GrClassicMyAssignmentsPage() {
  const s = await grcStudentPage('/gr-classic/student/assignments')
  if (!s.ok) return <TeachersOnly who="students" message={s.error} />
  return <AssignmentsBoard items={await listStudentAssignments(s.admin, s.studentId)} />
}
