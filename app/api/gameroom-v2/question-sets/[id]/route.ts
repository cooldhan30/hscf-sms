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
import { validateQuestionSetLimits, planQuestionReplacement } from '@/lib/gameRoomV2/security/limits'

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
// the full question list in one call. The builder always submits the
// complete current list; each question that carries the id of a
// question already in THIS set is updated in place, new ones are
// inserted, and only questions the teacher actually removed are
// deleted (see planQuestionReplacement). This used to be a wholesale
// delete-then-reinsert, which -- because answers cascade from
// questions, and learning events from answers -- silently erased every
// student's answer history and all teacher analytics for the set on
// every save, and broke in-progress sessions pointing at the old ids.
// RLS ("gamev2_question_sets: teacher manage own" / "gamev2_questions:
// teacher manage own set") is the real ownership enforcement -- the set
// update below simply affects 0 rows if this caller doesn't own it.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, isAdmin } = guard

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
  // Only touch class_id when the caller actually sent it. The Builder
  // never sends classId (class scoping is the Library's Assign action),
  // so writing optionalString(undefined) = null here unassigned the set
  // from its class on every Builder save.
  const classIdProvided = 'classId' in body
  const classId = optionalString(body.classId)

  const rawQuestions: IncomingQuestion[] = Array.isArray(body.questions) ? body.questions : []

  const limitProblems = validateQuestionSetLimits({ title, description, tags, questions: rawQuestions })
  if (limitProblems.length > 0) {
    return NextResponse.json({ error: limitProblems.join('; ') }, { status: 400 })
  }

  if (classIdProvided && classId && !isAdmin) {
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
      ...(classIdProvided ? { class_id: classId } : {}),
      question_types: questionTypes,
      question_count: rawQuestions.length,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (setError || !questionSet) {
    return NextResponse.json({ error: 'Question set not found, or you do not own it' }, { status: 404 })
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('sms_gamev2_questions')
    .select('id')
    .eq('question_set_id', params.id)
  if (existingError) {
    return NextResponse.json({ error: 'Failed to load existing questions' }, { status: 400 })
  }

  const questionRows = rawQuestions.map((q, i) => ({
    question_set_id: params.id,
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

  const plan = planQuestionReplacement(
    (existingRows ?? []).map((r) => r.id as string),
    rawQuestions.map((q) => q.id)
  )

  if (plan.deleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('sms_gamev2_questions')
      .delete()
      .eq('question_set_id', params.id)
      .in('id', plan.deleteIds)
    if (deleteError) {
      return NextResponse.json({ error: 'Failed to remove deleted questions' }, { status: 400 })
    }
  }

  if (plan.updateIndexes.length > 0) {
    const { error: updateError } = await supabase
      .from('sms_gamev2_questions')
      .upsert(
        plan.updateIndexes.map((i) => ({ id: rawQuestions[i].id as string, ...questionRows[i] })),
        { onConflict: 'id' }
      )
    if (updateError) {
      return NextResponse.json({ error: 'Failed to update questions' }, { status: 400 })
    }
  }

  if (plan.insertIndexes.length > 0) {
    const { error: insertError } = await supabase.from('sms_gamev2_questions').insert(plan.insertIndexes.map((i) => questionRows[i]))
    if (insertError) {
      return NextResponse.json({ error: 'Failed to add new questions' }, { status: 400 })
    }
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
