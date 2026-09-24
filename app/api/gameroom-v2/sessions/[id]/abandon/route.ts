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
  const { admin, studentId, session } = guard

  if (session.status === 'COMPLETED' || session.status === 'ABANDONED') {
    return NextResponse.json({ error: `Cannot exit -- game is already "${session.status}"` }, { status: 409 })
  }

  // Only from a non-terminal status -- a concurrent final answer that
  // just COMPLETED the session must never be flipped to ABANDONED.
  const { data: updated } = await admin
    .from('sms_gamev2_sessions')
    .update({ status: 'ABANDONED', abandoned_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('student_id', studentId)
    .in('status', ['CREATED', 'READY', 'ACTIVE', 'PAUSED'])
    .select()
    .maybeSingle()

  if (!updated) {
    return NextResponse.json({ error: 'Failed to exit -- refresh your game state' }, { status: 409 })
  }

  return NextResponse.json({ status: updated.status })
}
