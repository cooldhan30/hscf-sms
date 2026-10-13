import { HostLive } from '@/components/grClassic/live/HostLive'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { loadTeacherGame } from '@/lib/grClassic/server/teacherGame'

export default async function GrClassicHostPage({ params }: { params: { gameId: string } }) {
  const r = await loadTeacherGame(`/gr-classic/host/${params.gameId}`, params.gameId)
  if (!r.ok) return <TeachersOnly message={r.error} />
  return <HostLive game={r.game} />
}
