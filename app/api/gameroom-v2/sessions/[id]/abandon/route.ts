import { NextResponse } from 'next/server'
import { requireGameV2Session } from '@/lib/gameRoomV2/requireSession'

// POST /api/gameroom-v2/sessions/[id]/abandon -- any non-terminal
// status -> ABANDONED. Called when a student deliberately exits mid-
// game (the "Exit" system from the request) rather than finishing --
// distinct from just closing the tab (which leaves the session sitting
// in whatever status it was in, recoverable on refresh via
// state/route.ts, per "persist enough state to safely recover from
// refresh/disconnection"). An ABANDONED session is terminal: no more
// answers can be submitted, and it's never finalized for rewards (no
// XP/coins for a game the student chose not to finish).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Session(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, session } = guard

  if (session.status === 'COMPLETED' || session.status === 'ABANDONED') {
    return NextResponse.json({ error: `Cannot exit -- game is already "${session.status}"` }, { status: 409 })
  }

  const { data: updated, error } = await supabase
    .from('sms_gamev2_sessions')
    .update({ status: 'ABANDONED', abandoned_at: new Date().toISOString() })
    .eq('id', session.id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message || 'Failed to exit' }, { status: 400 })
  }

  return NextResponse.json({ status: updated.status })
}
