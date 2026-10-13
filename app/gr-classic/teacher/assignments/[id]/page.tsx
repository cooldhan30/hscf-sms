import { notFound } from 'next/navigation'
import { AssignmentResults } from '@/components/grClassic/teacher/AssignmentResults'
import { assignmentById, gameById } from '@/lib/grClassic/sampleData'

export default function GrClassicResultsPage({ params }: { params: { id: string } }) {
  const assignment = assignmentById(params.id)
  if (!assignment) notFound()
  return <AssignmentResults assignment={assignment} game={gameById(assignment.gameId)!} />
}
