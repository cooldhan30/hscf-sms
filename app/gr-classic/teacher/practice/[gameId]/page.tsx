import { notFound } from 'next/navigation'
import { PracticeStatsView } from '@/components/grClassic/teacher/PracticeStatsView'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { practiceStats } from '@/lib/grClassic/server/practiceStats'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// How the teacher's students have practised one of their games.
export default async function GrClassicPracticeStatsPage({ params }: { params: { gameId: string } }) {
  if (!isUuid(params.gameId)) notFound()
  const t = await grcTeacherPage(`/gr-classic/teacher/practice/${params.gameId}`)
  if (!t.ok) return <TeachersOnly message={t.error} />
  const stats = await practiceStats(t.supabase, params.gameId)
  if (!stats) notFound()
  return <PracticeStatsView stats={stats} />
}
