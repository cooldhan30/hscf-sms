import { notFound } from 'next/navigation'
import { PracticeRunner } from '@/components/grClassic/student/PracticeRunner'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { toPlayQuestion } from '@/lib/grClassic/play'
import { practiceGame } from '@/lib/grClassic/server/practice'
import { grcStudentPage } from '@/lib/grClassic/server/studentAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// A student practises a game from one of their teachers. Only the
// answer-free questions are sent to the browser.
export default async function GrClassicPracticePage({ params }: { params: { gameId: string } }) {
  if (!isUuid(params.gameId)) notFound()
  const s = await grcStudentPage(`/gr-classic/practice/${params.gameId}`)
  if (!s.ok) return <TeachersOnly who="students" message={s.error} />
  const game = await practiceGame(s.admin, s.studentId, params.gameId).catch(() => null)
  if (!game) notFound()
  return <PracticeRunner gameId={game.id} title={game.title} type={game.type} questions={game.questions.map(toPlayQuestion)} />
}
