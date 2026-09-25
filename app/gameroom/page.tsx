import { redirect } from 'next/navigation'
import { currentGameRoomRole, classicGameRoomPath, newGameRoomPath } from '@/lib/gameRoomMode'
import { isGameRoomV2Released } from '@/lib/gameRoomV2/release'
import { ModeSelectorClient } from './ModeSelectorClient'

export const dynamic = 'force-dynamic'

// GameRoom entry point (the sidebar's "Game Room" item): lets students
// and teachers choose between the new GameRoom and Classic.
//
// Temporary migration fallback. Remove Classic GameRoom only after
// GameRoom V2 production stabilization.
export default async function GameRoomModeSelectorPage() {
  const { userId, role } = await currentGameRoomRole()
  if (!userId) redirect(`/login?next=${encodeURIComponent('/gameroom')}`)

  const classic = classicGameRoomPath(role)
  const next = newGameRoomPath(role)

  // Rolled back (GAMEROOM_V2_ENABLED=false): everyone goes straight to Classic.
  if (!isGameRoomV2Released() && classic) redirect(classic)
  // Admins have no Classic GameRoom page; parents have no GameRoom at all.
  if (!classic) redirect(next ?? '/')

  const dashboard = role === 'teacher' ? '/teacher' : '/student'
  return <ModeSelectorClient newHref="/gameroom/v2" classicHref="/gameroom/classic" dashboardHref={dashboard} />
}
