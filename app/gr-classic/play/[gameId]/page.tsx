import { notFound } from 'next/navigation'
import { GamePlayer } from '@/components/grClassic/games/GamePlayer'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { toPlayQuestion } from '@/lib/grClassic/play'
import { loadTeacherGame } from '@/lib/grClassic/server/teacherGame'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// Teacher preview of one of their own saved games. Students practise at
// /gr-classic/practice/<id> and play assignments at /gr-classic/assignment/<id>.
export default async function GrClassicPlayPage({ params }: { params: { gameId: string } }) {
  if (!isUuid(params.gameId)) notFound()
  const r = await loadTeacherGame(`/gr-classic/play/${params.gameId}`, params.gameId)
  if (!r.ok) return <TeachersOnly message={r.error} />
  // Answer-free questions; answers are checked by /api/gr-classic/games/<id>/check.
  return <GamePlayer game={{ title: r.game.title, type: r.game.type }} play={{ source: 'remote', base: `/games/${r.game.id}`, questions: r.game.questions.map(toPlayQuestion) }} mode="preview" exit={{ href: '/gr-classic/teacher' }} />
}
