import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'

// POST /api/game-room/sessions/[id]/resume -- teacher-only. Un-pauses:
// accumulates the elapsed pause duration onto pause_duration_seconds,
// then shifts every incomplete player's current_question_started_at
// forward by that same duration so their in-flight question's remaining
// time is exactly what it was the moment the game was paused -- paused
// time never counts against a student's timer.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const { data: session } = await supabase
    .from('sms_game_sessions')
    .select('status, paused_at, pause_duration_seconds')
    .eq('id', params.id)
    .single()
  if (!session) {
    return NextResponse.json({ error: 'Game session not found' }, { status: 404 })
  }
  if (session.status !== 'paused' || !session.paused_at) {
    return NextResponse.json({ error: `Cannot resume a session that is "${session.status}"` }, { status: 409 })
  }

  const pausedForSeconds = Math.round((Date.now() - new Date(session.paused_at).getTime()) / 1000)

  const { data: updated, error } = await supabase
    .from('sms_game_sessions')
    .update({
      status: 'active',
      paused_at: null,
      pause_duration_seconds: session.pause_duration_seconds + pausedForSeconds,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message || 'Failed to resume session' }, { status: 400 })
  }

  // Shift every incomplete player's timer anchor forward by the pause
  // duration -- a raw column-to-column update (not a fetch+recompute
  // round trip), safe to run unconditionally for the whole session.
  const { error: shiftError } = await supabase.rpc('sms_shift_game_player_timers', {
    p_session_id: params.id,
    p_seconds: pausedForSeconds,
  })
  if (shiftError) {
    return NextResponse.json({ error: shiftError.message }, { status: 400 })
  }

  return NextResponse.json({ session: updated })
}
