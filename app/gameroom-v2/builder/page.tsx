import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { FiLock } from 'react-icons/fi'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { GameV2Error } from '@/components/gameRoomV2'
import { BuilderListClient, type QuestionSetRow } from './BuilderListClient'

export const dynamic = 'force-dynamic'

// The Question Set Builder's landing page: every set the caller can
// see (own, at any visibility, plus other teachers' SCHOOL/PUBLIC sets
// per migration 074's RLS), and a "Create New Set" entry point into the
// wizard at /gameroom-v2/builder/new. Same access gate as every other
// V2 route, further narrowed to teacher role (requireGameV2Teacher()).
export default async function QuestionSetBuilderPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/gameroom-v2/builder')}`)
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

  const { supabase, profile } = access

  const { data: questionSets, error: setsError } = await supabase
    .from('sms_gamev2_question_sets')
    .select('*, creator:sms_profiles(first_name, last_name)')
    .order('updated_at', { ascending: false })

  if (setsError) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-gamev2ink-950 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <GameV2Error description="Something went wrong loading your question sets. Please refresh the page." />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-gamev2ink-950 px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/gameroom-v2/library" className="text-xs font-bold uppercase tracking-wide text-gamev2spark-600 dark:text-gamev2spark-400 hover:underline">
            ← Question Set Library
          </Link>
          <h1 className="text-2xl font-black text-gamev2ink-900 dark:text-white mt-0.5">Question Set Builder</h1>
          <p className="text-gamev2ink-500 dark:text-gamev2ink-400 mt-1 max-w-lg">
            Create content once, then play it through any compatible game engine -- a question set is independent of
            any one game.
          </p>
        </div>

        <BuilderListClient questionSets={(questionSets ?? []) as QuestionSetRow[]} currentProfileId={profile.id} />
      </div>
    </div>
  )
}
