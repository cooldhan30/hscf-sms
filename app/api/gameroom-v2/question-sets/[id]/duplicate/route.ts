import { NextResponse } from 'next/server'
import { stripSystemTags } from '@/lib/gameRoomV2/builtin/protection'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'

// POST /api/gameroom-v2/question-sets/[id]/duplicate -- makes a fully
// independent copy of a set the caller can currently READ (their own,
// or a SCHOOL/PUBLIC set per migration 074's RLS -- fetching the
// source row below fails with 404 if RLS wouldn't let the caller see
// it, which doubles as this route's authorization check). The copy:
//
// - Gets brand new set + question rows (new UUIDs) -- there is no FK
//   or shared row between the original and the copy, so editing the
//   copy (or deleting it) can NEVER affect the original in any way.
// - Resets visibility to PRIVATE and published to false regardless of
//   the source's values -- duplicating someone else's SCHOOL-shared
//   set shouldn't silently make your copy visible to the whole school
//   too; the duplicating teacher explicitly re-shares it if they want
//   to.
// - created_by becomes the duplicating teacher -- they now own and can
//   edit/delete the copy freely, per "the copy becomes independent."
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, profile } = guard

  const { data: source, error: sourceError } = await supabase
    .from('sms_gamev2_question_sets')
    .select('*')
    .eq('id', params.id)
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 })
  }

  const { data: sourceQuestions, error: questionsError } = await supabase
    .from('sms_gamev2_questions')
    .select('*')
    .eq('question_set_id', params.id)
    .order('sort_order', { ascending: true })

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 400 })
  }

  const { data: copy, error: copyError } = await supabase
    .from('sms_gamev2_question_sets')
    .insert([
      {
        title: `${source.title} (Copy)`,
        description: source.description,
        tamil_title: source.tamil_title,
        english_title: source.english_title,
        level: source.level,
        subject: source.subject,
        topic: source.topic,
        difficulty: source.difficulty,
        estimated_duration_minutes: source.estimated_duration_minutes,
        // System markers (e.g. the built-in content tags) never carry over.
        tags: stripSystemTags(source.tags ?? []),
        language: source.language,
        visibility: 'PRIVATE',
        published: false,
        class_id: null,
        created_by: profile.id,
        question_types: source.question_types,
        question_count: source.question_count,
      },
    ])
    .select()
    .single()

  if (copyError || !copy) {
    return NextResponse.json({ error: copyError?.message || 'Failed to duplicate question set' }, { status: 400 })
  }

  const copiedQuestionRows = (sourceQuestions ?? []).map((q) => ({
    question_set_id: copy.id,
    sort_order: q.sort_order,
    question_type: q.question_type,
    prompt: q.prompt,
    payload: q.payload,
    explanation: q.explanation,
    media_url: q.media_url,
    points: q.points,
  }))

  if (copiedQuestionRows.length > 0) {
    const { error: insertError } = await supabase.from('sms_gamev2_questions').insert(copiedQuestionRows)
    if (insertError) {
      // Roll back the orphaned copy rather than leaving a question-less
      // duplicate behind.
      await supabase.from('sms_gamev2_question_sets').delete().eq('id', copy.id)
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }
  }

  // Best-effort usage log -- a failed log write should never fail the
  // duplicate itself, which already fully succeeded above.
  await supabase.from('sms_gamev2_question_set_usage').insert([
    { question_set_id: params.id, profile_id: profile.id, action: 'DUPLICATE' },
  ])

  return NextResponse.json({ questionSet: copy }, { status: 201 })
}
