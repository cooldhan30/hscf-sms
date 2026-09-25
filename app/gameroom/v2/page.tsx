import { redirect } from 'next/navigation'
import { currentGameRoomRole, classicGameRoomPath, newGameRoomPath } from '@/lib/gameRoomMode'
import { isGameRoomV2Released } from '@/lib/gameRoomV2/release'

export const dynamic = 'force-dynamic'

// /gameroom/v2 -> the new GameRoom page for the caller's role.
export default async function NewGameRoomRedirect() {
  const { userId, role } = await currentGameRoomRole()
  if (!userId) redirect(`/login?next=${encodeURIComponent('/gameroom/v2')}`)
  if (!isGameRoomV2Released() && role !== 'admin') redirect(classicGameRoomPath(role) ?? '/')
  redirect(newGameRoomPath(role) ?? '/')
}
