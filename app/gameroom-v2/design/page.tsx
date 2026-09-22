import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { FiLock } from 'react-icons/fi'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { DesignGalleryClient } from './DesignGalleryClient'

export const dynamic = 'force-dynamic'

// Internal-only component showcase -- lets the team review every
// GameRoom V2 visual component/state before any real game is built on
// top of them. Gated identically to the main /gameroom-v2 page (admin,
// or a row in sms_gamev2_testers) -- not linked from any nav, reachable
// only by direct URL.
export default async function GameRoomV2DesignGalleryPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/gameroom-v2/design')}`)
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
            The GameRoom V2 design gallery isn&apos;t open to your account yet.
          </p>
        </div>
      </div>
    )
  }

  return <DesignGalleryClient />
}
