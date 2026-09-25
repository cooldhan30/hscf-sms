import { NextResponse } from 'next/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { requireString, optionalString } from '@/lib/validation'
import {
  QUESTION_SET_VISIBILITIES,
  QUESTION_SET_DIFFICULTIES,
  GAME_ROOM_V2_QUESTION_TYPES,
  isImplementedQuestionType,
  validateQuestionSet,
  detectLanguage,
  type GameRoomQuestionType,
} from '@/lib/gameRoomV2/domain'
import { isLearningDimension } from '@/lib/gameRoomV2/analytics'
import { validateQuestionSetLimits } from '@/lib/gameRoomV2/security/limits'
import { fetchQuestionSetUsageCounts } from '@/lib/gameRoomV2/questionSetUsage'

// GET /api/gameroom-v2/question-sets -- lists question sets visible to
// the caller: their own (any visibility, via RLS "gamev2_question_sets:
// teacher manage own") plus any other teacher's SCHOOL/PUBLIC sets (RLS
// "gamev2_question_sets: teacher read shared", migration 074), enriched
// with the caller's own favorite/recently-used status and each set's
// real usage count. RLS is the real visibility scoping -- this route
// does no additional filtering; the Library's Title/Topic/Level/
// Difficulty/Type/Language/Creator/Tags search happens client-side over
// this same list, matching how components/resources/ResourcesClient.tsx
// already filters its (similarly teacher-scoped, not internet-scale)
// library client-side.
export async function GET() {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, profile } = guard

  const [{ data: questionSets, error }, { data: favoriteRows }, { data: recentUsageRows }] = await Promise.all([
    supabase
      .from('sms_gamev2_question_sets')
      // Explicit FK hints -- unhinted embeds are ambiguous (favorites/live
      // sessions are junction tables to profiles/classes) -> PGRST201.
      .select('*, class:sms_classes!class_id(id, name), creator:sms_profiles!created_by(first_name, last_name)')
      .order('updated_at', { ascending: false }),
    // RLS ("gamev2_favorites: teacher manage own") already scopes this
    // to the caller's own favorites.
    supabase.from('sms_gamev2_favorites').select('question_set_id'),
    // RLS ("gamev2_usage: teacher manage own") scopes this to the
    // caller's own usage history -- the real data behind "Recently
    // Used". Capped generously; the client further dedupes to one
    // entry per set (most recent action) and slices to a short list.
    supabase
      .from('sms_gamev2_question_set_usage')
      .select('question_set_id, action, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const favoriteIds = new Set((favoriteRows ?? []).map((f) => f.question_set_id))

  // Real usage count per set (DUPLICATE+ASSIGN across every teacher,
  // via a SECURITY DEFINER RPC so this never has to expose raw
  // cross-teacher usage rows) -- ONE batched call for every set (it used
  // to be one RPC per set); "if available" per the spec means this is
  // simply omitted client-side wherever it comes back 0, never fabricated.
  const usageCountById = await fetchQuestionSetUsageCounts(
    supabase,
    (questionSets ?? []).map((s) => s.id)
  )

  return NextResponse.json({
    questionSets: (questionSets ?? []).map((s) => ({
      ...s,
      isFavorite: favoriteIds.has(s.id),
      usageCount: usageCountById.get(s.id) ?? 0,
    })),
    recentUsage: recentUsageRows ?? [],
    currentProfileId: profile.id,
  })
}

interface IncomingQuestion {
  questionType?: string
  prompt?: string
  payload?: unknown
  explanation?: string | null
  mediaUrl?: string | null
  points?: number
  dimension?: string | null
  conceptTags?: string[]
}

// POST /api/gameroom-v2/question-sets -- create a question set AND its
// questions in one call (the builder's "Save" step submits the whole
// set at once, not question-by-question, so validation can see the set
// as a whole -- e.g. "at least one question" -- before anything is
// persisted). Fully rejects the save if any question is malformed;
// never partially saves a set with some invalid questions dropped.
export async function POST(request: Request) {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, profile, isAdmin } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const title = requireString(body.title, 'Title', errors)
  const description = optionalString(body.description)
  const tamilTitle = optionalString(body.tamilTitle)
  const englishTitle = optionalString(body.englishTitle)
  const level = optionalString(body.level)
  const subject = optionalString(body.subject)
  const topic = optionalString(body.topic)
  const difficulty =
    body.difficulty == null || body.difficulty === ''
      ? null
      : (() => {
          if (!QUESTION_SET_DIFFICULTIES.includes(body.difficulty)) {
            errors.push('Difficulty must be easy, medium, or hard')
            return null
          }
          return body.difficulty
        })()
  const estimatedDurationMinutes =
    body.estimatedDurationMinutes == null || body.estimatedDurationMinutes === ''
      ? null
      : Number(body.estimatedDurationMinutes)
  if (estimatedDurationMinutes !== null && (Number.isNaN(estimatedDurationMinutes) || estimatedDurationMinutes <= 0)) {
    errors.push('Estimated duration must be a positive number of minutes')
  }
  const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0) : []
  const visibility = QUESTION_SET_VISIBILITIES.includes(body.visibility) ? body.visibility : 'PRIVATE'
  const published = Boolean(body.published)
  const classId = optionalString(body.classId)

  const rawQuestions: IncomingQuestion[] = Array.isArray(body.questions) ? body.questions : []

  // Size/shape bounds first -- rejects an oversized or abusive payload
  // before any per-question validation work runs on it.
  const limitProblems = validateQuestionSetLimits({ title, description, tags, questions: rawQuestions })
  if (limitProblems.length > 0) {
    return NextResponse.json({ error: limitProblems.join('; ') }, { status: 400 })
  }

  // Same ownership rule the assign route already enforces -- a set can
  // only be scoped to a class the author actually teaches.
  if (classId && !isAdmin) {
    const { data: owns } = await supabase.rpc('sms_teacher_owns_class', { p_class_id: classId })
    if (!owns) {
      return NextResponse.json({ error: 'Class not found or not assigned to you' }, { status: 403 })
    }
  }

  const questionsForValidation = rawQuestions.map((q) => ({
    questionType: (q.questionType ?? '') as GameRoomQuestionType,
    prompt: q.prompt ?? '',
    payload: q.payload,
  }))

  for (const q of questionsForValidation) {
    if (!GAME_ROOM_V2_QUESTION_TYPES.includes(q.questionType)) {
      errors.push(`Unknown question type: "${q.questionType}"`)
    } else if (!isImplementedQuestionType(q.questionType)) {
      errors.push(`"${q.questionType}" cannot be authored yet`)
    }
  }
  // Dimension is optional per question but, if present, must be one of
  // the 7 fixed learning dimensions (mirrors the DB CHECK constraint --
  // validated here too so a bad value is rejected with a clear message
  // instead of a raw DB constraint error).
  for (const q of rawQuestions) {
    if (q.dimension != null && q.dimension !== '' && !isLearningDimension(q.dimension)) {
      errors.push(`Invalid learning dimension: "${q.dimension}"`)
    }
  }
  if (errors.length === 0) {
    errors.push(...validateQuestionSet(questionsForValidation))
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const questionTypes = Array.from(new Set(questionsForValidation.map((q) => q.questionType)))
  const language = detectLanguage([title, tamilTitle ?? '', englishTitle ?? '', ...rawQuestions.map((q) => q.prompt ?? '')])

  const { data: questionSet, error: setError } = await supabase
    .from('sms_gamev2_question_sets')
    .insert([
      {
        title,
        description,
        tamil_title: tamilTitle,
        english_title: englishTitle,
        level,
        subject,
        topic,
        difficulty,
        estimated_duration_minutes: estimatedDurationMinutes,
        tags,
        visibility,
        language,
        published,
        class_id: classId,
        created_by: profile.id,
        question_types: questionTypes,
        question_count: rawQuestions.length,
      },
    ])
    .select()
    .single()

  if (setError || !questionSet) {
    return NextResponse.json({ error: setError?.message || 'Failed to create question set' }, { status: 400 })
  }

  const questionRows = rawQuestions.map((q, i) => ({
    question_set_id: questionSet.id,
    sort_order: i,
    question_type: q.questionType,
    prompt: (q.prompt ?? '').trim(),
    payload: q.payload ?? {},
    explanation: optionalString(q.explanation ?? null),
    media_url: optionalString(q.mediaUrl ?? null),
    points: typeof q.points === 'number' && Number.isInteger(q.points) && q.points > 0 ? q.points : 100,
    dimension: isLearningDimension(q.dimension) ? q.dimension : null,
    concept_tags: Array.isArray(q.conceptTags) ? q.conceptTags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0) : [],
  }))

  const { error: questionsError } = await supabase.from('sms_gamev2_questions').insert(questionRows)

  if (questionsError) {
    // The set row was already created above -- clean it up so a failed
    // save doesn't leave an empty, orphaned set behind (ON DELETE
    // CASCADE also removes any partially-inserted question rows).
    await supabase.from('sms_gamev2_question_sets').delete().eq('id', questionSet.id)
    return NextResponse.json({ error: questionsError.message }, { status: 400 })
  }

  return NextResponse.json({ questionSet }, { status: 201 })
}
