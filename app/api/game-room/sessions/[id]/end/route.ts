import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'

// POST /api/game-room/sessions/[id]/end -- teacher-only manual override
// (spec: "teacher should also have a MANUALLY END GAME option in case
// some students leave or disconnect"). The same 'ended' transition also
// happens automatically in app/api/game-room/answer/route.ts once every
// player has completed the quiz -- this route exists for the case where
// that never happens (a student never finishes/disconnects).
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
  if (session.status === 'ended') {
    return NextResponse.json({ error: 'Session has already ended' }, { status: 409 })
  }

  const { data: updated, error } = await supabase
    .from('sms_game_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message || 'Failed to end session' }, { status: 400 })
  }

  return NextResponse.json({ session: updated })
}
