import { StudentHome } from '@/components/grClassic/student/StudentHome'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcStudentPage, listStudentAssignments } from '@/lib/grClassic/server/studentAssignments'

export default async function GrClassicStudentPage() {
  const s = await grcStudentPage('/gr-classic/student')
  if (!s.ok) return <TeachersOnly who="students" message={s.error} />
  return <StudentHome name={s.firstName} assignments={await listStudentAssignments(s.admin, s.studentId)} />
}
