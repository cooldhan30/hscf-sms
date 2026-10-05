import { NextResponse } from 'next/server'
import { requireGameV2Session } from '@/lib/gameRoomV2/requireSession'
import { BALLOON_POP_ENGINE_ID, checkPop } from '@/lib/gameRoomV2/balloonPop/stream'

// POST /api/gameroom-v2/sessions/[id]/pop-check -- { questionIndex, item } -> { isTarget, category }
//
// Balloon Pop's "pop every உயிரெழுத்து" rounds need an instant yes/no for
// each balloon the child pops. /state sends a CATEGORIZE question's items
// and categories but never its answer key, so this route answers one
// popped item at a time. Same narrow shape as pair-check:
// - only the signed-in student's own session (requireGameV2Session),
// - only a Balloon Pop session,
// - only while ACTIVE, only for the CURRENT question, only CATEGORIZE.
// It awards nothing and writes nothing: the round's pops go to /answer,
// which scores them (lib/gameRoomV2/balloonPop/stream.ts gradePops).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Session(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { admin, session } = guard

  if (session.engine_id !== BALLOON_POP_ENGINE_ID) {
    return NextResponse.json({ error: 'Pop checks are only for Balloon Pop' }, { status: 403 })
  }
  if (session.status !== 'ACTIVE') {
    return NextResponse.json({ error: `Cannot check -- game is "${session.status}"` }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const questionIndex = Number(body?.questionIndex)
  const item = body?.item
  if (typeof item !== 'string' || item.length > 500) {
    return NextResponse.json({ error: 'item must be a short string' }, { status: 400 })
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
  if (question.question_type !== 'CATEGORIZE') {
    return NextResponse.json({ error: 'The current question is not a sorting question' }, { status: 409 })
  }

  const result = checkPop(question.payload as Record<string, unknown>, questionIndex, item)
  if (!result) return NextResponse.json({ error: 'That balloon is not in this round' }, { status: 400 })
  return NextResponse.json(result)
}
