import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { FiPlus } from 'react-icons/fi'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { fetchQuestionSetUsageCounts } from '@/lib/gameRoomV2/questionSetUsage'
import { GameV2Error } from '@/components/gameRoomV2'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { PageHeader, primaryLinkButton } from '@/components/gameRoomV2/shell/ui'
import { ensureBuiltinContent } from '@/lib/gameRoomV2/builtin/ensure'
import { isBuiltinSetId } from '@/lib/gameRoomV2/builtin/catalog'
import { allTopicSummaries } from '@/lib/gameRoomV2/builtin/summaries'
import { LibraryClient, type LibraryTab } from './LibraryClient'
import type { LibrarySet } from './LibrarySetCard'

export const dynamic = 'force-dynamic'

// The Question Set Library -- discovery and reuse, distinct from the
// Builder's own "my sets, for editing" list (/gameroom-v2/builder).
// Same access gate as every other V2 route (requireGameV2Teacher()),
// no nav link. Queries Supabase directly (server component), same
// convention as every other page in this app, rather than the page
// calling its own API route internally.
const TABS: LibraryTab[] = ['builtin', 'my-sets', 'shared', 'favorites', 'recent']

export default async function QuestionSetLibraryPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/gameroom-v2/library')}`)
  }

  const access = await requireGameV2Teacher()
  if (!access.ok) {
    return (
      <GameRoomShell>
        <GameRoomUnavailable message={access.error} />
      </GameRoomShell>
    )
  }

  await ensureBuiltinContent()

  const { supabase, profile, teacher } = access
  const initialTab: LibraryTab = TABS.includes(searchParams.tab as LibraryTab) ? (searchParams.tab as LibraryTab) : 'builtin'

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
        // Explicit FK hint: sms_gamev2_favorites (profile_id, question_set_id)
        // is a many-to-many junction to sms_profiles too, so an unhinted
        // embed is ambiguous and PostgREST rejects the whole query (PGRST201).
        .select('*, creator:sms_profiles!created_by(first_name, last_name)')
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

    // Built-in Tamil content is listed by topic in its own tab (below),
    // not mixed into My/Shared sets.
    enrichedSets = (questionSets ?? []).filter((s) => !isBuiltinSetId(s.id)).map((s) => ({
      ...s,
      isFavorite: favoriteIds.has(s.id),
      usageCount: usageCountById.get(s.id) ?? 0,
    }))

    // Most-recent-first, deduped to one entry per set.
    recentSetIds = Array.from(new Set((recentUsageRows ?? []).map((r) => r.question_set_id))).slice(0, 20)

    classOptions = ((classes ?? []) as { class: { id: string; name: string } | null }[])
      .map((c) => c.class)
      .filter((c): c is { id: string; name: string } => Boolean(c))
  } catch (err) {
    // Server log keeps the real cause (PostgREST code/message); the user
    // sees only a safe message plus a reference code.
    const e = err as { code?: string; message?: string }
    console.error('[gameroom-v2/library] failed to load question sets', { code: e?.code, message: e?.message })
    loadError = `We couldn't load your question sets. Please refresh the page.${e?.code ? ` (ref: ${e.code})` : ''}`
  }

  if (loadError) {
    return (
      <GameRoomShell>
        <div className="max-w-5xl mx-auto">
          <GameV2Error description={loadError} />
        </div>
      </GameRoomShell>
    )
  }

  return (
    <GameRoomShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Question Set Library"
          description="Built-in Tamil content, your own sets, and sets shared by other teachers. Preview, host live, duplicate or edit."
          backHref="/gameroom-v2"
          backLabel="Game Room"
          actions={
            <Link href="/gameroom-v2/builder/new" className={primaryLinkButton}>
              <FiPlus className="w-4 h-4" aria-hidden /> Create Question Set
            </Link>
          }
        />

        <LibraryClient
          initialSets={enrichedSets}
          currentProfileId={profile.id}
          recentSetIds={recentSetIds}
          classes={classOptions}
          builtinTopics={allTopicSummaries()}
          initialTab={initialTab}
        />
      </div>
    </GameRoomShell>
  )
}
