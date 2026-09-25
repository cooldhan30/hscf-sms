import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { JoinCodeClient } from './JoinCodeClient'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'

export const dynamic = 'force-dynamic'

// The student flow's "Enter join code" step. Same access-gate/no-nav-
// link convention as every other V2 route.
export default async function LiveJoinPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/gameroom-v2/live/join')}`)
  }

  const access = await requireGameV2Access()
  if (!access.ok) {
    return (
      <GameRoomShell>
        <GameRoomUnavailable message={access.error} />
      </GameRoomShell>
    )
  }

  return (
    <GameRoomShell>
      <div className="flex justify-center py-6">
        <JoinCodeClient />
      </div>
    </GameRoomShell>
  )
}
