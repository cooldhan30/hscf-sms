import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { FiLock } from 'react-icons/fi'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { PlaySessionClient } from './PlaySessionClient'

export const dynamic = 'force-dynamic'

// Generic play screen for any V2 session -- mounts GameSessionRuntime
// directly, so this one page works for every engine that has no extra
// visual layer of its own (today: only classic-quiz). An engine that
// DOES want its own board/animation layer around the shared runtime
// would get its own route instead of this generic one; this is
// intentionally the "thin reference engine" path, not a permanent home
// for every future engine.
export default async function PlaySessionPage({ params }: { params: { sessionId: string } }) {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/gameroom-v2/play/${params.sessionId}`)}`)
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
    <div className="min-h-screen bg-stone-50 dark:bg-gamev2ink-950">
      <PlaySessionClient sessionId={params.sessionId} />
    </div>
  )
}
