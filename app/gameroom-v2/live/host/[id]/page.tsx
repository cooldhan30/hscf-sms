import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { FiLock } from 'react-icons/fi'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { HostDashboardClient } from './HostDashboardClient'

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
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center">
            <FiLock className="w-6 h-6 text-stone-500 dark:text-stone-400" />
          </div>
          <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-1">Not available yet</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">{access.error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 dark:from-gamev2ink-950 dark:to-gamev2ink-900 px-4 sm:px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <HostDashboardClient liveSessionId={params.id} />
      </div>
    </div>
  )
}
