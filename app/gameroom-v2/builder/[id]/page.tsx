import { redirect, notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { FiLock } from 'react-icons/fi'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { BuilderWizard, type BuilderInitialData } from '@/components/gameRoomV2/builder/BuilderWizard'
import { emptyMetadata, type SetMetadata } from '@/components/gameRoomV2/builder/MetadataStep'
import type { DraftQuestion } from '@/components/gameRoomV2/builder/types'
import type { GameRoomQuestionType, QuestionSetDifficulty, QuestionSetVisibility } from '@/lib/gameRoomV2/domain'

export const dynamic = 'force-dynamic'

export default async function EditQuestionSetPage({ params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/gameroom-v2/builder/${params.id}`)}`)
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

  const { supabase } = access

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
    <div className="min-h-screen bg-stone-50 dark:bg-gamev2ink-950 px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto mb-6">
        <p className="text-xs font-bold uppercase tracking-wide text-gamev2spark-600 dark:text-gamev2spark-400">
          Question Set Builder
        </p>
        <h1 className="text-2xl font-black text-gamev2ink-900 dark:text-white mt-0.5">Edit &quot;{questionSet.title}&quot;</h1>
      </div>
      <BuilderWizard initial={initial} />
    </div>
  )
}
