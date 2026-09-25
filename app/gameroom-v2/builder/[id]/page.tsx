import { redirect, notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { BuilderWizard, type BuilderInitialData } from '@/components/gameRoomV2/builder/BuilderWizard'
import { emptyMetadata, type SetMetadata } from '@/components/gameRoomV2/builder/types'
import type { DraftQuestion } from '@/components/gameRoomV2/builder/types'
import type { GameRoomQuestionType, QuestionSetDifficulty, QuestionSetVisibility } from '@/lib/gameRoomV2/domain'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { PageHeader } from '@/components/gameRoomV2/shell/ui'
import { DuplicateButton } from '@/components/gameRoomV2/learning/DuplicateButton'
import { topicForSetId } from '@/lib/gameRoomV2/builtin/catalog'

export const dynamic = 'force-dynamic'

export default async function EditQuestionSetPage({ params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/gameroom-v2/builder/${params.id}`)}`)
  }

  const access = await requireGameV2Teacher()
  if (!access.ok) {
    return (
      <GameRoomShell>
        <GameRoomUnavailable message={access.error} />
      </GameRoomShell>
    )
  }

  const { supabase } = access

  // Canonical built-in content is read-only: offer a copy instead of the editor.
  const builtinTopic = topicForSetId(params.id)
  if (builtinTopic) {
    return (
      <GameRoomShell>
        <div className="max-w-2xl mx-auto space-y-6">
          <PageHeader
            title="Built-in Tamil content"
            tamilTitle={builtinTopic.tamilTitle}
            description="This question set is part of the built-in Tamil library and can't be edited. Duplicate it to My Question Sets to make your own version."
            backHref={`/gameroom-v2/topics/${builtinTopic.key}`}
            backLabel={builtinTopic.englishTitle}
          />
          <DuplicateButton questionSetId={params.id} />
        </div>
      </GameRoomShell>
    )
  }

  const { data: questionSet } = await supabase.from('sms_gamev2_question_sets').select('*').eq('id', params.id).single()
  if (!questionSet) {
    notFound()
  }

  const { data: questionRows } = await supabase
    .from('sms_gamev2_questions')
    .select('*')
    .eq('question_set_id', params.id)
    .order('sort_order', { ascending: true })

  const metadata: SetMetadata = {
    ...emptyMetadata(),
    title: questionSet.title ?? '',
    description: questionSet.description ?? '',
    tamilTitle: questionSet.tamil_title ?? '',
    englishTitle: questionSet.english_title ?? '',
    level: questionSet.level ?? '',
    subject: questionSet.subject ?? '',
    topic: questionSet.topic ?? '',
    difficulty: (questionSet.difficulty as QuestionSetDifficulty) ?? '',
    estimatedDurationMinutes: questionSet.estimated_duration_minutes ? String(questionSet.estimated_duration_minutes) : '',
    tags: questionSet.tags ?? [],
    visibility: (questionSet.visibility as QuestionSetVisibility) ?? 'PRIVATE',
    published: Boolean(questionSet.published),
  }

  const questions: DraftQuestion[] = (questionRows ?? []).map((q) => ({
    localId: q.id,
    id: q.id,
    questionType: q.question_type as GameRoomQuestionType,
    prompt: q.prompt,
    payload: (q.payload as Record<string, unknown>) ?? {},
    explanation: q.explanation ?? '',
    mediaUrl: q.media_url,
    points: q.points,
    dimension: (q.dimension as DraftQuestion['dimension']) ?? null,
    conceptTags: q.concept_tags ?? [],
  }))

  const initial: BuilderInitialData = { id: questionSet.id, metadata, questions }

  return (
    <GameRoomShell>
      <div className="max-w-4xl mx-auto mb-6">
        <PageHeader title={`Edit "${questionSet.title}"`} backHref="/gameroom-v2/builder" backLabel="Question Set Builder" />
      </div>
      <BuilderWizard initial={initial} />
    </GameRoomShell>
  )
}
