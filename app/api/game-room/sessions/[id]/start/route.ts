import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'

// POST /api/game-room/sessions/[id]/start -- teacher-only. This is the
// ONE host action that begins gameplay -- there is deliberately no
// per-question host action anywhere in this API. Once a session moves
// to 'active', every joined player independently starts progressing
// through their own shuffled question order via /api/game-room/state
// polling; the host never intervenes again except to pause/resume/end.
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
  if (session.status !== 'waiting') {
    return NextResponse.json({ error: `Cannot start a session that is already "${session.status}"` }, { status: 409 })
  }

  const { data: updated, error } = await supabase
    .from('sms_game_sessions')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message || 'Failed to start session' }, { status: 400 })
  }

  return NextResponse.json({ session: updated })
}
