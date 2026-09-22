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

// GET /api/gameroom-v2/question-sets/[id] -- one set with its full
// ordered question list, for the builder's edit/preview steps. RLS
// (073's "teacher manage own" + "tester read published" + 074's
// "teacher read shared") is the real scoping; a set the caller can't
// see returns 404 here rather than a raw RLS-empty-result.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

  const { data: questionSet, error: setError } = await supabase
    .from('sms_gamev2_question_sets')
    .select('*, class:sms_classes(id, name), creator:sms_profiles(first_name, last_name)')
    .eq('id', params.id)
    .single()

  if (setError || !questionSet) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 })
  }

  const { data: questions, error: questionsError } = await supabase
    .from('sms_gamev2_questions')
    .select('*')
    .eq('question_set_id', params.id)
    .order('sort_order', { ascending: true })

  if (questionsError) return NextResponse.json({ error: questionsError.message }, { status: 400 })

  return NextResponse.json({ questionSet, questions: questions ?? [] })
}

interface IncomingQuestion {
  id?: string
  questionType?: string
  prompt?: string
  payload?: unknown
  explanation?: string | null
  mediaUrl?: string | null
  points?: number
  dimension?: string | null
  conceptTags?: string[]
}

// PATCH /api/gameroom-v2/question-sets/[id] -- updates metadata AND
// replaces the full question list in one call. Questions are replaced
// wholesale (delete-then-reinsert) rather than diffed -- the builder's
// "Preview -> Validate -> Save" flow always submits the complete
// current question list, so there's no partial-update case to support,
// and this sidesteps having to reconcile client-side reordering against
// server-side row identity. RLS ("gamev2_question_sets: teacher manage
// own" / "gamev2_questions: teacher manage own set") is the real
// ownership enforcement -- the update below simply affects 0 rows if
// this caller doesn't own the set.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

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
    .update({
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
      question_types: questionTypes,
      question_count: rawQuestions.length,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (setError || !questionSet) {
    return NextResponse.json({ error: setError?.message || 'Question set not found, or you do not own it' }, { status: 404 })
  }

  const { error: deleteError } = await supabase.from('sms_gamev2_questions').delete().eq('question_set_id', params.id)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  const questionRows = rawQuestions.map((q, i) => ({
    question_set_id: params.id,
    sort_order: i,
    question_type: q.questionType,
    prompt: (q.prompt ?? '').trim(),
    payload: q.payload ?? {},
    explanation: optionalString(q.explanation ?? null),
    media_url: optionalString(q.mediaUrl ?? null),
    points: typeof q.points === 'number' && q.points > 0 ? q.points : 100,
    dimension: isLearningDimension(q.dimension) ? q.dimension : null,
    concept_tags: Array.isArray(q.conceptTags) ? q.conceptTags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0) : [],
  }))

  const { error: insertError } = await supabase.from('sms_gamev2_questions').insert(questionRows)
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  return NextResponse.json({ questionSet })
}

// DELETE /api/gameroom-v2/question-sets/[id] -- RLS scopes this to the
// caller's own sets (or any set, for admin); ON DELETE CASCADE (073)
// removes the set's questions automatically.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

  const { data, error } = await supabase.from('sms_gamev2_question_sets').delete().eq('id', params.id).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Question set not found, or you do not own it' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
