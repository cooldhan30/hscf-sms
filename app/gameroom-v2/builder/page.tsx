import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { GameV2Error } from '@/components/gameRoomV2'
import { BuilderListClient, type QuestionSetRow } from './BuilderListClient'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { PageHeader } from '@/components/gameRoomV2/shell/ui'
import { isBuiltinSetId } from '@/lib/gameRoomV2/builtin/catalog'

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
      <GameRoomShell>
        <GameRoomUnavailable message={access.error} />
      </GameRoomShell>
    )
  }

  const { supabase, profile } = access

  const { data: questionSets, error: setsError } = await supabase
    .from('sms_gamev2_question_sets')
    // Explicit FK hint -- see library/page.tsx (ambiguous embed, PGRST201).
    .select('*, creator:sms_profiles!created_by(first_name, last_name)')
    .order('updated_at', { ascending: false })

  if (setsError) {
    console.error('[gameroom-v2/builder] failed to load question sets', { code: setsError.code, message: setsError.message })
    return (
      <GameRoomShell>
        <div className="max-w-5xl mx-auto">
          <GameV2Error description="Something went wrong loading your question sets. Please refresh the page." />
        </div>
      </GameRoomShell>
    )
  }

  return (
    <GameRoomShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Question Set Builder"
          description="Create content once, then play it through any compatible game -- a question set is independent of any one game."
          backHref="/gameroom-v2/library"
          backLabel="Question Set Library"
        />

        {/* Built-in Tamil content is read-only and lives in the Library's
            Built-in tab; the Builder lists only editable/shared sets. */}
        <BuilderListClient
          questionSets={((questionSets ?? []) as QuestionSetRow[]).filter((s) => !isBuiltinSetId(s.id))}
          currentProfileId={profile.id}
        />
      </div>
    </GameRoomShell>
  )
}
