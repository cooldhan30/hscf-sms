import { StudentHome } from '@/components/grClassic/student/StudentHome'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { practiceGames } from '@/lib/grClassic/server/practice'
import { grcStudentPage, listStudentAssignments } from '@/lib/grClassic/server/studentAssignments'

export default async function GrClassicStudentPage() {
  const s = await grcStudentPage('/gr-classic/student')
  if (!s.ok) return <TeachersOnly who="students" message={s.error} />
  const [assignments, practice] = await Promise.all([listStudentAssignments(s.admin, s.studentId), practiceGames(s.admin, s.studentId)])
  return <StudentHome name={s.firstName} assignments={assignments} practice={practice} />
}
