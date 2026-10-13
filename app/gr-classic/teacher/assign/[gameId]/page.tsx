import { AssignForm } from '@/components/grClassic/teacher/AssignForm'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { loadTeacherGame } from '@/lib/grClassic/server/teacherGame'

export default async function GrClassicAssignPage({ params }: { params: { gameId: string } }) {
  const r = await loadTeacherGame(`/gr-classic/teacher/assign/${params.gameId}`, params.gameId)
  if (!r.ok) return <TeachersOnly message={r.error} />
  return <AssignForm game={r.game} />
}
