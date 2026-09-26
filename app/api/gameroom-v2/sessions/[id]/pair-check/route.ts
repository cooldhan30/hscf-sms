import { NextResponse } from 'next/server'
import { requireGameV2Session } from '@/lib/gameRoomV2/requireSession'
import { PAIR_CHECK_ENGINES, isPairInMatchPayload } from '@/lib/gameRoomV2/matching/pairCheck'

// POST /api/gameroom-v2/sessions/[id]/pair-check -- { questionIndex, left, right } -> { isPair }
//
// Matching and Memory are games of finding pairs, so each attempted pair
// needs an immediate yes/no. /state only ever sends the two sides of a
// MATCH question, shuffled independently with a server-only salt, so the
// client cannot know the pairs; this route answers one attempted pair
// at a time. It is deliberately narrow:
// - only the signed-in student's own session (requireGameV2Session),
// - only a Matching or Memory session (never Classic Quiz or any engine
//   where a MATCH question is a one-shot knowledge check),
// - only while ACTIVE, only for the CURRENT question, only MATCH.
// It awards nothing and writes nothing: grading, points (server-timed)
// and rewards stay in /answer and /complete.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Session(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { admin, session } = guard

  if (!PAIR_CHECK_ENGINES.includes(session.engine_id)) {
    return NextResponse.json({ error: 'Pair checks are not available for this game' }, { status: 403 })
  }
  if (session.status !== 'ACTIVE') {
    return NextResponse.json({ error: `Cannot check -- game is "${session.status}"` }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const questionIndex = Number(body?.questionIndex)
  const left = body?.left
  const right = body?.right
  if (typeof left !== 'string' || typeof right !== 'string' || left.length > 500 || right.length > 500) {
    return NextResponse.json({ error: 'left and right must be short strings' }, { status: 400 })
  }
  if (!Number.isInteger(questionIndex) || questionIndex !== session.current_index) {
    return NextResponse.json({ error: 'This question is no longer current -- refresh your game state' }, { status: 409 })
  }

  const questionId = session.question_order[questionIndex]
  if (!questionId) return NextResponse.json({ error: 'No question at this index' }, { status: 409 })

  const { data: question } = await admin
    .from('sms_gamev2_questions')
    .select('question_type, payload')
    .eq('id', questionId)
    .eq('question_set_id', session.question_set_id)
    .single()
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 500 })
  if (question.question_type !== 'MATCH') {
    return NextResponse.json({ error: 'The current question is not a matching question' }, { status: 409 })
  }

  return NextResponse.json({ isPair: isPairInMatchPayload(question.payload, left, right) })
}
