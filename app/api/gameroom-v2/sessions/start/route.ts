import { NextResponse } from 'next/server'
import { requireGameV2Student } from '@/lib/gameRoomV2/requireStudentAccess'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireString } from '@/lib/validation'
import { getGameEngineV2 } from '@/lib/gameRoomV2/registry'
import { checkGameLaunch, isEngineLaunchable } from '@/lib/gameRoomV2/gameAvailability'
import { shuffle } from '@/lib/gameRoomV2/shuffle'
import { SESSION_START_LIMIT, exceedsSessionStartLimit } from '@/lib/gameRoomV2/security/limits'

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
//
// Writes and question reads go through the server-only admin client
// (migration 083: students can no longer write sessions or read
// question payloads directly). The question-SET lookup still runs
// through the student's own RLS client -- that lookup is the
// authorization for "may this student play this set at all".
export async function POST(request: Request) {
  const guard = await requireGameV2Student()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, student } = guard
  const admin = createAdminClient()

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
  if (!isEngineLaunchable(engine)) {
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

  // The same rule every picker displays (lib/gameRoomV2/gameAvailability.ts).
  const launch = checkGameLaunch(engine.id, questionSet.question_types ?? [], 'solo')
  if (!launch.ok) {
    return NextResponse.json({ error: launch.error }, { status: launch.status })
  }

  const since = new Date(Date.now() - SESSION_START_LIMIT.windowMinutes * 60 * 1000).toISOString()
  const { count: recentStarts } = await supabase
    .from('sms_gamev2_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', student.id)
    .gte('created_at', since)
  if (exceedsSessionStartLimit(recentStarts ?? 0)) {
    return NextResponse.json({ error: 'Too many games started -- take a short break and try again' }, { status: 429 })
  }

  const { data: questions } = await admin
    .from('sms_gamev2_questions')
    .select('id')
    .eq('question_set_id', questionSet.id)

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
  const { data: session, error } = await admin
    .from('sms_gamev2_sessions')
    .insert([
      {
        question_set_id: questionSet.id,
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
    return NextResponse.json({ error: 'Failed to start session' }, { status: 400 })
  }

  return NextResponse.json({ sessionId: session.id }, { status: 201 })
}
