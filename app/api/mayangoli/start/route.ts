import { NextResponse } from 'next/server'
import { requireMayangoliHost } from '@/lib/gameRoom/modules/mayangoli/requireSession'

// POST /api/mayangoli/start -- teacher-only. Body: { sessionId }. Moves
// the room from 'waiting' to 'active' and starts question 0 -- the
// server-authoritative timer anchor (current_question_started_at) is
// set here, never trusted from any client.
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

  if (session.status !== 'waiting') {
    return NextResponse.json({ error: `Cannot start -- game is already "${session.status}"` }, { status: 409 })
  }
  if (session.question_ids.length === 0) {
    return NextResponse.json({ error: 'This session has no questions configured' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from('sms_mayangoli_sessions')
    .update({
      status: 'active',
      current_question_index: 0,
      current_question_started_at: now,
      started_at: now,
    })
    .eq('id', session.id)
    .eq('status', 'waiting')
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message || 'Failed to start game' }, { status: 400 })
  }

  return NextResponse.json({ status: updated.status, currentQuestionIndex: updated.current_question_index })
}
