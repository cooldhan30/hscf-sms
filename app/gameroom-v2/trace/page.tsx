import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { FiLock } from 'react-icons/fi'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { TraceLearn } from '@/components/gameRoomV2/trace/TraceLearn'

export const dynamic = 'force-dynamic'

// Trace & Learn (எழுதிப் பழகு): letter tracing practice for little
// learners. Not a game session -- no questions, no server XP -- so it has
// its own page, behind the same GameRoom access check as the games.
export default async function TracePage() {
  const { userId } = await auth()
  if (!userId) redirect(`/login?next=${encodeURIComponent('/gameroom-v2/trace')}`)

  const access = await requireGameV2Access()
  if (!access.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center">
            <FiLock className="w-6 h-6 text-stone-500 dark:text-stone-400" />
          </div>
          <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-1">
            <span className="font-tamil">இன்னும் கிடைக்கவில்லை</span> · Not available yet
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">{access.error}</p>
        </div>
      </div>
    )
  }

  return <TraceLearn />
}
