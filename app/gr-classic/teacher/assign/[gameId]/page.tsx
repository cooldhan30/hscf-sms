import { notFound } from 'next/navigation'
import { AssignForm } from '@/components/grClassic/teacher/AssignForm'
import { gameById } from '@/lib/grClassic/sampleData'

export default function GrClassicAssignPage({ params }: { params: { gameId: string } }) {
  const game = gameById(params.gameId)
  if (!game) notFound()
  return <AssignForm game={game} />
}
