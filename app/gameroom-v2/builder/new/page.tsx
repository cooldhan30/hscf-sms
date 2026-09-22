import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { FiLock } from 'react-icons/fi'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { BuilderWizard } from '@/components/gameRoomV2/builder/BuilderWizard'

export const dynamic = 'force-dynamic'

export default async function NewQuestionSetPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/gameroom-v2/builder/new')}`)
  }

  const access = await requireGameV2Teacher()
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
    <div className="min-h-screen bg-stone-50 dark:bg-gamev2ink-950 px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto mb-6">
        <p className="text-xs font-bold uppercase tracking-wide text-gamev2spark-600 dark:text-gamev2spark-400">
          Question Set Builder
        </p>
        <h1 className="text-2xl font-black text-gamev2ink-900 dark:text-white mt-0.5">Create New Set</h1>
        <p className="text-gamev2ink-500 dark:text-gamev2ink-400 mt-1 max-w-lg">
          Create content once, then play it through any compatible game engine later.
        </p>
      </div>
      <BuilderWizard />
    </div>
  )
}
