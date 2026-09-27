import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { PageHeader } from '@/components/gameRoomV2/shell/ui'
import { GameV2Loading } from '@/components/gameRoomV2'
import { HostLiveSetup } from '@/components/gameRoomV2/liveClassroom/HostLiveSetup'

export const dynamic = 'force-dynamic'

// Host Live: Question set -> Class -> Game -> Start Now, on one screen.
// Teacher-only data comes from /api/gameroom-v2/live/host-options (which
// enforces the teacher role); the session itself is created server-side
// by /api/gameroom-v2/live/host.
export default async function HostLivePage() {
  const { userId } = await auth()
  if (!userId) redirect(`/login?next=${encodeURIComponent('/gameroom-v2/live/host')}`)
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
      <div className="max-w-5xl mx-auto space-y-4">
        <PageHeader title="Host Live" tamilTitle="நேரலை வகுப்பு" description="Pick a question set, a class and a game -- then Start Now. Your class joins with a code." />
        <Suspense fallback={<GameV2Loading label="Loading..." />}>
          <HostLiveSetup />
        </Suspense>
      </div>
    </GameRoomShell>
  )
}
