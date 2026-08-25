import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'

// POST /api/game-room/sessions/[id]/pause -- teacher-only. Freezes every
// player's timer: while status is 'paused', students see a paused screen
// and current_question_started_at is never advanced, so no time is lost
// against them (see resume/route.ts for how the frozen duration is
// credited back).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const { data: session } = await supabase.from('sms_game_sessions').select('status').eq('id', params.id).single()
  if (!session) {
    return NextResponse.json({ error: 'Game session not found' }, { status: 404 })
  }
  if (session.status !== 'active') {
    return NextResponse.json({ error: `Cannot pause a session that is "${session.status}"` }, { status: 409 })
  }

  const { data: updated, error } = await supabase
    .from('sms_game_sessions')
    .update({ status: 'paused', paused_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message || 'Failed to pause session' }, { status: 400 })
  }

  return NextResponse.json({ session: updated })
}
