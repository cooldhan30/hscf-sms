import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { requireString } from '@/lib/validation'
import { getGameEngineV2 } from '@/lib/gameRoomV2/registry'
import { checkEngineCompatibility } from '@/lib/gameRoomV2/domain'
import { shuffle } from '@/lib/gameRoomV2/shuffle'

// POST /api/gameroom-v2/sessions/start -- CREATED status. Body:
// { questionSetId, engineId }. Validates:
//   1. The engine is a real, registered engine (getGameEngineV2).
//   2. The engine is actually compatible with the set's question types
//      (checkEngineCompatibility) -- a student can never start a
//      session pairing a set with an engine that can't play it, even
//      by crafting the request directly.
//   3. The set has at least one question (an empty set can't be
//      played -- mirrors the Builder's own "a question set needs at
//      least one question" rule).
// The question order is shuffled ONCE here (lib/gameRoomV2/shuffle.ts,
// forked from legacy GameRoom rather than imported -- see that file's
// header) and persisted on the session row -- never re-derived, so
// "question 3 of 10" means the same thing across every refresh/resume.
export async function POST(request: Request) {
  const guard = await requireStudent()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, student } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const questionSetId = requireString(body.questionSetId, 'Question set', errors)
  const engineId = requireString(body.engineId, 'Game engine', errors)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const engine = getGameEngineV2(engineId)
  if (!engine) {
    return NextResponse.json({ error: 'Unknown game engine' }, { status: 400 })
  }
  if (engine.status !== 'ACTIVE' && engine.status !== 'BETA') {
    return NextResponse.json({ error: `${engine.name} is not playable yet (${engine.status})` }, { status: 409 })
  }

  // RLS ("gamev2_question_sets: tester read published" / "... teacher
  // read shared" / "... teacher manage own") scopes this to sets the
  // student is actually allowed to see -- a set they have no access to
  // simply yields no row here, same precedent as every other
  // RLS-as-boundary GET in this codebase.
  const { data: questionSet } = await supabase
    .from('sms_gamev2_question_sets')
    .select('id, question_types')
    .eq('id', questionSetId)
    .maybeSingle()

  if (!questionSet) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 })
  }

  const compatible = checkEngineCompatibility([engine], questionSet.question_types)[0]
  if (!compatible.compatible) {
    return NextResponse.json(
      { error: `${engine.name} does not support: ${compatible.unsupportedTypes.join(', ')}` },
      { status: 409 }
    )
  }

  const { data: questions } = await supabase
    .from('sms_gamev2_questions')
    .select('id')
    .eq('question_set_id', questionSetId)

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'This question set has no questions' }, { status: 409 })
  }

  const questionOrder = shuffle(questions.map((q) => q.id))

  // Created READY, not ACTIVE -- the question order/timer setup below
  // is already done, but the session only becomes ACTIVE (and its timer
  // anchor starts counting) on the client's first /state call, which is
  // also when started_at is set. This keeps "the clock is running" tied
  // to the moment the student's client actually confirms it's showing
  // the first question, not to whenever this request happened to reach
  // the server.
  const { data: session, error } = await supabase
    .from('sms_gamev2_sessions')
    .insert([
      {
        question_set_id: questionSetId,
        engine_id: engineId,
        student_id: student.id,
        status: 'READY',
        question_order: questionOrder,
        current_index: 0,
      },
    ])
    .select()
    .single()

  if (error || !session) {
    return NextResponse.json({ error: error?.message || 'Failed to start session' }, { status: 400 })
  }

  return NextResponse.json({ sessionId: session.id }, { status: 201 })
}
