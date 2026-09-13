import { NextResponse } from 'next/server'
import { requireMayangoliHost } from '@/lib/gameRoom/modules/mayangoli/requireSession'

// POST /api/mayangoli/advance -- teacher-only. Body: { sessionId,
// action: 'reveal' | 'next' }. The room's state machine:
//   'active' (question N live, students answering)
//     --reveal--> 'reveal' (answer + per-question stats shown)
//     --next-->   'active' (question N+1) OR 'ended' (N+1 out of range)
// Both transitions are host-driven (no client-trusted auto-advance
// timer) -- matches the spec's "no client-trusted timers" requirement;
// the countdown UI is purely cosmetic on the client, this is the only
// place that actually moves the room forward.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const guard = await requireMayangoliHost(body.sessionId)
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, session } = guard

  const action = body.action
  if (action !== 'reveal' && action !== 'next') {
    return NextResponse.json({ error: 'action must be "reveal" or "next"' }, { status: 400 })
  }

  if (action === 'reveal') {
    if (session.status !== 'active') {
      return NextResponse.json({ error: `Cannot reveal -- game is "${session.status}"` }, { status: 409 })
    }
    const { data: updated, error } = await supabase
      .from('sms_mayangoli_sessions')
      .update({ status: 'reveal' })
      .eq('id', session.id)
      .eq('status', 'active')
      .select()
      .single()

    if (error || !updated) {
      return NextResponse.json({ error: error?.message || 'Failed to reveal' }, { status: 400 })
    }
    return NextResponse.json({ status: updated.status, currentQuestionIndex: updated.current_question_index })
  }

  // action === 'next'
  if (session.status !== 'reveal') {
    return NextResponse.json({ error: `Cannot advance -- game is "${session.status}"` }, { status: 409 })
  }

  const nextIndex = session.current_question_index + 1
  const isLastQuestion = nextIndex >= session.question_ids.length

  const { data: updated, error } = await supabase
    .from('sms_mayangoli_sessions')
    .update(
      isLastQuestion
        ? { status: 'ended', ended_at: new Date().toISOString() }
        : {
            status: 'active',
            current_question_index: nextIndex,
            current_question_started_at: new Date().toISOString(),
          }
    )
    .eq('id', session.id)
    .eq('status', 'reveal')
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message || 'Failed to advance' }, { status: 400 })
  }

  return NextResponse.json({ status: updated.status, currentQuestionIndex: updated.current_question_index })
}
