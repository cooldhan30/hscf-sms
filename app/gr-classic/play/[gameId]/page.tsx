import { notFound } from 'next/navigation'
import { GamePlayer, type PlayMode } from '@/components/grClassic/games/GamePlayer'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { assignmentById, gameById, studentAssignments } from '@/lib/grClassic/sampleData'
import { loadTeacherGame } from '@/lib/grClassic/server/teacherGame'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// One player for every mode: ?mode=practice | preview | assignment&a=<assignment id>
// A saved game (uuid) can only be previewed by its own teacher for now;
// student practice and assignments on saved games arrive in Phases 4-6.
export default async function GrClassicPlayPage({ params, searchParams }: { params: { gameId: string }; searchParams: { mode?: string; a?: string } }) {
  const mode: PlayMode = searchParams.mode === 'assignment' || searchParams.mode === 'preview' ? searchParams.mode : 'practice'

  if (isUuid(params.gameId)) {
    if (mode !== 'preview') notFound()
    const r = await loadTeacherGame(`/gr-classic/play/${params.gameId}?mode=preview`, params.gameId)
    if (!r.ok) return <TeachersOnly message={r.error} />
    return <GamePlayer game={r.game} mode="preview" exit={{ href: '/gr-classic/teacher' }} />
  }

  const game = gameById(params.gameId)
  if (!game) notFound()
  if (mode === 'assignment') {
    const assignment = searchParams.a ? assignmentById(searchParams.a) : undefined
    if (!assignment || assignment.gameId !== game.id) notFound()
    const used = studentAssignments().find((x) => x.assignment.id === assignment.id)?.attemptsUsed ?? 0
    const max = assignment.settings.maxAttempts
    return (
      <GamePlayer
        game={game}
        mode="assignment"
        assignment={{ attemptsLeftAfter: max === null ? null : Math.max(0, max - used - 1), showScore: true, randomize: assignment.settings.randomize, dueAt: assignment.dueAt }}
        exit={{ href: '/gr-classic/student/assignments' }}
      />
    )
  }
  return <GamePlayer game={game} mode={mode} exit={{ href: mode === 'preview' ? '/gr-classic/teacher' : '/gr-classic/student#practice' }} />
}
