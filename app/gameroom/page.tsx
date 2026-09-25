import { redirect } from 'next/navigation'
import { currentGameRoomRole, classicGameRoomPath, newGameRoomPath } from '@/lib/gameRoomMode'
import { isGameRoomV2Released } from '@/lib/gameRoomV2/release'

export const dynamic = 'force-dynamic'

// GameRoom entry point (the sidebar's "Game Room" item). Opens GameRoom V2
// directly -- there is no Classic/V2 chooser.
//
// Emergency rollback only: with GAMEROOM_V2_ENABLED=false (Vercel env var
// + redeploy) this sends students and teachers to the preserved legacy
// GameRoom instead. See docs/gameroom-v2-rollback.md.
export default async function GameRoomEntryPage() {
  const { userId, role } = await currentGameRoomRole()
  if (!userId) redirect(`/login?next=${encodeURIComponent('/gameroom')}`)

  const legacy = classicGameRoomPath(role)
  if (!isGameRoomV2Released() && legacy) redirect(legacy)

  redirect(newGameRoomPath(role) ?? '/')
}
