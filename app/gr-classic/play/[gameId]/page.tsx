import { notFound } from 'next/navigation'
import { GamePlayer, type PlayMode } from '@/components/grClassic/games/GamePlayer'
import { assignmentById, gameById, studentAssignments } from '@/lib/grClassic/sampleData'

// One player for every mode: ?mode=practice | preview | assignment&a=<assignment id>
export default function GrClassicPlayPage({ params, searchParams }: { params: { gameId: string }; searchParams: { mode?: string; a?: string } }) {
  const game = gameById(params.gameId)
  if (!game) notFound()
  const mode: PlayMode = searchParams.mode === 'assignment' || searchParams.mode === 'preview' ? searchParams.mode : 'practice'

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
