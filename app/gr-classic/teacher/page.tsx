import { TeacherDashboard } from '@/components/grClassic/teacher/TeacherDashboard'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { categoryNames, listCategories, listGames } from '@/lib/grClassic/server/db'
import { listTeacherAssignments } from '@/lib/grClassic/server/teacherAssignments'

export default async function GrClassicTeacherPage({ searchParams }: { searchParams: { pick?: string; tab?: string } }) {
  const t = await grcTeacherPage('/gr-classic/teacher')
  if (!t.ok) return <TeachersOnly message={t.error} />
  const [games, assignments] = await Promise.all([listGames(t.supabase, categoryNames(await listCategories(t.supabase, t.userId))), listTeacherAssignments(t.supabase, t.userId)])
  const pick = searchParams.pick === 'host' || searchParams.pick === 'assign' ? searchParams.pick : undefined
  return <TeacherDashboard games={games} assignments={assignments} pick={pick} tab={searchParams.tab === 'assignments' ? 'assignments' : 'games'} />
}
