import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { FiLock, FiPlus } from 'react-icons/fi'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { fetchQuestionSetUsageCounts } from '@/lib/gameRoomV2/questionSetUsage'
import { GameV2Button, GameV2Error } from '@/components/gameRoomV2'
import { GameRoomModeSwitch } from '@/components/gameRoomMode/GameRoomModeSwitch'
import { LibraryClient } from './LibraryClient'
import type { LibrarySet } from './LibrarySetCard'

export const dynamic = 'force-dynamic'

// The Question Set Library -- discovery and reuse, distinct from the
// Builder's own "my sets, for editing" list (/gameroom-v2/builder).
// Same access gate as every other V2 route (requireGameV2Teacher()),
// no nav link. Queries Supabase directly (server component), same
// convention as every other page in this app, rather than the page
// calling its own API route internally.
export default async function QuestionSetLibraryPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/gameroom-v2/library')}`)
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

  const { supabase, profile, teacher } = access

  let enrichedSets: LibrarySet[] = []
  let recentSetIds: string[] = []
  let classOptions: { id: string; name: string }[] = []
  let loadError: string | null = null

  try {
    const [{ data: questionSets, error: setsError }, { data: favoriteRows }, { data: recentUsageRows }, { data: classes }] = await Promise.all([
      // RLS ("gamev2_question_sets: teacher manage own" + "... teacher
      // read shared") already scopes this to own sets (any visibility)
      // plus other teachers' SCHOOL/PUBLIC sets.
      supabase
        .from('sms_gamev2_question_sets')
        .select('*, creator:sms_profiles(first_name, last_name)')
        .order('updated_at', { ascending: false }),
      supabase.from('sms_gamev2_favorites').select('question_set_id'),
      supabase
        .from('sms_gamev2_question_set_usage')
        .select('question_set_id, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
      teacher
        ? supabase.from('sms_class_teachers').select('class:sms_classes(id, name)').eq('teacher_id', teacher.id)
        : Promise.resolve({ data: [] as { class: { id: string; name: string } | null }[] }),
    ])

    if (setsError) throw setsError

    const favoriteIds = new Set((favoriteRows ?? []).map((f) => f.question_set_id))

    // One batched round trip, not one RPC per set (see questionSetUsage.ts).
    const usageCountById = await fetchQuestionSetUsageCounts(
      supabase,
      (questionSets ?? []).map((s) => s.id)
    )

    enrichedSets = (questionSets ?? []).map((s) => ({
      ...s,
      isFavorite: favoriteIds.has(s.id),
      usageCount: usageCountById.get(s.id) ?? 0,
    }))

    // Most-recent-first, deduped to one entry per set.
    recentSetIds = Array.from(new Set((recentUsageRows ?? []).map((r) => r.question_set_id))).slice(0, 20)

    classOptions = ((classes ?? []) as { class: { id: string; name: string } | null }[])
      .map((c) => c.class)
      .filter((c): c is { id: string; name: string } => Boolean(c))
  } catch {
    loadError = 'Something went wrong loading your question sets. Please refresh the page.'
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-gamev2ink-950 px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <GameV2Error description={loadError} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-gamev2ink-950 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/teacher" className="text-xs font-bold uppercase tracking-wide text-gamev2spark-600 dark:text-gamev2spark-400 hover:underline">
              ← Dashboard · Game Room
            </Link>
            <h1 className="text-2xl font-black text-gamev2ink-900 dark:text-white mt-0.5">Question Set Library</h1>
            <p className="text-gamev2ink-500 dark:text-gamev2ink-400 mt-1 max-w-lg">
              Discover and reuse content -- yours, shared by the school, or public. Pick a set to play it or host it live.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Temporary migration fallback. Remove Classic GameRoom only after GameRoom V2 production stabilization. */}
            {teacher && <GameRoomModeSwitch to="classic" />}
            <Link href="/gameroom-v2/builder/new">
              <GameV2Button variant="spark">
                <FiPlus className="w-4 h-4" /> Create New Set
              </GameV2Button>
            </Link>
          </div>
        </div>

        <LibraryClient initialSets={enrichedSets} currentProfileId={profile.id} recentSetIds={recentSetIds} classes={classOptions} />
      </div>
    </div>
  )
}
