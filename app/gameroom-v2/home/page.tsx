import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { FiLock } from 'react-icons/fi'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { HomeScreenClient } from './HomeScreenClient'

export const dynamic = 'force-dynamic'

// The GameRoom V2 student arcade home screen. Same top-level-route,
// data-gated-access pattern as /gameroom-v2 and /gameroom-v2/design
// (see lib/gameRoomV2/requireAccess.ts) -- not linked from any nav,
// not reachable via any role-prefixed middleware redirect, and not
// wired into legacy GameRoom in any way.
//
// The greeting uses the caller's real first_name (from sms_profiles,
// already fetched by requireGameV2Access()) -- but XP/coins/"Continue
// Playing"/"Recent Accomplishments" are honestly empty for every
// student today, since no session/player/achievement persistence
// exists yet for V2 (see lib/gameRoomV2/README.md). This page renders
// real empty states for those rather than inventing placeholder
// numbers, per the "do not create fake functionality" requirement.
export default async function GameRoomV2HomePage() {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/gameroom-v2/home')}`)
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
          <p className="text-sm text-stone-500 dark:text-stone-400">
            GameRoom V2 is still in development and isn&apos;t open to your account yet.
          </p>
        </div>
      </div>
    )
  }

  const displayName = access.profile.first_name || 'Player'

  return <HomeScreenClient studentName={displayName} />
}
