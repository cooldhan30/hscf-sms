import { StudentHome } from '@/components/grClassic/student/StudentHome'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcStudentPage, listStudentAssignments } from '@/lib/grClassic/server/studentAssignments'
import { topicScores } from '@/lib/grClassic/server/topicProgress'

export default async function GrClassicStudentPage() {
  const s = await grcStudentPage('/gr-classic/student')
  if (!s.ok) return <TeachersOnly who="students" message={s.error} />
  const [assignments, scores] = await Promise.all([listStudentAssignments(s.admin, s.studentId), topicScores(s.admin, s.studentId)])
  return <StudentHome name={s.firstName} assignments={assignments} scores={scores} />
}
