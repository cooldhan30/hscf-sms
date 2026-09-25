import { redirect } from 'next/navigation'
import { currentGameRoomRole, classicGameRoomPath } from '@/lib/gameRoomMode'

export const dynamic = 'force-dynamic'

// /gameroom/classic -> the original GameRoom at its existing role route
// (/student/game-room or /teacher/game-room), unchanged.
//
// Temporary migration fallback. Remove Classic GameRoom only after
// GameRoom V2 production stabilization.
export default async function ClassicGameRoomRedirect() {
  const { userId, role } = await currentGameRoomRole()
  if (!userId) redirect(`/login?next=${encodeURIComponent('/gameroom/classic')}`)
  redirect(classicGameRoomPath(role) ?? '/')
}
