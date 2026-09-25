import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { HostDashboardClient } from './HostDashboardClient'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'

export const dynamic = 'force-dynamic'

// The teacher's Live Classroom host dashboard: join code, live roster
// with presence, and Start/Pause/Resume/End controls. Same
// access-gate/no-nav-link convention as every other V2 route --
// ownership itself (is this MY live session) is enforced by
// requireLiveSessionHost() inside every API route this page's client
// calls, not by this page.
export default async function LiveHostPage({ params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/gameroom-v2/live/host/${params.id}`)}`)
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
      <div className="max-w-3xl mx-auto">
        <HostDashboardClient liveSessionId={params.id} />
      </div>
    </GameRoomShell>
  )
}
