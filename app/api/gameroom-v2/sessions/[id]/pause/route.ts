import { NextResponse } from 'next/server'
import { requireGameV2Session } from '@/lib/gameRoomV2/requireSession'

// POST /api/gameroom-v2/sessions/[id]/pause -- ACTIVE -> PAUSED. Records
// paused_at so resume/route.ts can compute exactly how long the pause
// lasted and shift the question timer forward by that amount, the same
// "don't silently burn the student's remaining time while paused" idiom
// legacy GameRoom's pause/resume + sms_shift_game_player_timers uses
// (reimplemented here, not shared code -- see requireSession.ts).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Session(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, session } = guard

  if (session.status !== 'ACTIVE') {
    return NextResponse.json({ error: `Cannot pause -- game is "${session.status}"` }, { status: 409 })
  }

  const { data: updated, error } = await supabase
    .from('sms_gamev2_sessions')
    .update({ status: 'PAUSED', paused_at: new Date().toISOString() })
    .eq('id', session.id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message || 'Failed to pause' }, { status: 400 })
  }

  return NextResponse.json({ status: updated.status })
}
