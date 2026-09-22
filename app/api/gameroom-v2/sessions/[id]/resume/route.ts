import { NextResponse } from 'next/server'
import { requireGameV2Session } from '@/lib/gameRoomV2/requireSession'

// POST /api/gameroom-v2/sessions/[id]/resume -- PAUSED -> ACTIVE. Shifts
// current_question_started_at forward by exactly how long the pause
// lasted, so the remaining time on the current question is unchanged by
// the pause -- a student who pauses with 12s left on the clock still
// has 12s left after resuming, no matter how long the pause itself was.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Session(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, session } = guard

  if (session.status !== 'PAUSED') {
    return NextResponse.json({ error: `Cannot resume -- game is "${session.status}"` }, { status: 409 })
  }

  const pausedForSeconds = session.paused_at ? Math.round((Date.now() - new Date(session.paused_at).getTime()) / 1000) : 0

  const shiftedStart = session.current_question_started_at
    ? new Date(new Date(session.current_question_started_at).getTime() + pausedForSeconds * 1000).toISOString()
    : new Date().toISOString()

  const { data: updated, error } = await supabase
    .from('sms_gamev2_sessions')
    .update({
      status: 'ACTIVE',
      paused_at: null,
      current_question_started_at: shiftedStart,
      pause_duration_seconds: session.pause_duration_seconds + pausedForSeconds,
    })
    .eq('id', session.id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message || 'Failed to resume' }, { status: 400 })
  }

  return NextResponse.json({ status: updated.status })
}
