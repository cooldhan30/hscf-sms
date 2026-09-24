import { NextResponse } from 'next/server'
import { requireLiveSessionParticipant } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'

// POST /api/gameroom-v2/live/[id]/heartbeat -- a participant's client
// calls this periodically (while in the lobby AND during active play)
// to keep last_seen_at fresh -- the actual presence signal
// isPresentlyConnected() checks (see lib/gameRoomV2/liveClassroom/
// presence.ts). A client that stops calling this (crashed tab, lost
// network) is naturally detected as stale without needing an explicit
// disconnect event.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionParticipant(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { admin, studentId, participant } = guard

  await admin
    .from('sms_gamev2_live_participants')
    .update({ connected: true, last_seen_at: new Date().toISOString() })
    .eq('id', participant.id)
    .eq('student_id', studentId)

  return NextResponse.json({ ok: true })
}
