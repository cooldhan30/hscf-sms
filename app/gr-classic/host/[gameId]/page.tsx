import { notFound } from 'next/navigation'
import { HostLive } from '@/components/grClassic/live/HostLive'
import { gameById } from '@/lib/grClassic/sampleData'

export default function GrClassicHostPage({ params }: { params: { gameId: string } }) {
  const game = gameById(params.gameId)
  if (!game) notFound()
  return <HostLive game={game} />
}
