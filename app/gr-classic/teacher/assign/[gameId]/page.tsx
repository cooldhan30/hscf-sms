import { notFound } from 'next/navigation'
import { AssignForm } from '@/components/grClassic/teacher/AssignForm'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { categoryNames, getGame, listCategories } from '@/lib/grClassic/server/db'
import { teacherClasses } from '@/lib/grClassic/server/teacherAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

export default async function GrClassicAssignPage({ params }: { params: { gameId: string } }) {
  if (!isUuid(params.gameId)) notFound()
  const t = await grcTeacherPage(`/gr-classic/teacher/assign/${params.gameId}`)
  if (!t.ok) return <TeachersOnly message={t.error} />
  const [game, classes] = await Promise.all([getGame(t.supabase, params.gameId, categoryNames(await listCategories(t.supabase, t.userId))), teacherClasses(t.supabase)])
  if (!game) notFound()
  return <AssignForm game={{ id: game.id, title: game.title, type: game.type, category: game.category, questionCount: game.questions.length }} classes={classes} />
}
