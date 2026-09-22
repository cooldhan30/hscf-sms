import { NextResponse } from 'next/server'
import { requireLiveSessionParticipant } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'

// POST /api/gameroom-v2/live/[id]/leave -- an explicit "I'm leaving"
// signal (called on tab close/unmount, best-effort) -- immediately
// marks the participant disconnected rather than waiting up to the
// heartbeat staleness window to notice. A student can still rejoin
// later via /join (their participant row persists; the same
// reconnect path just marks it connected again).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionParticipant(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, participant } = guard

  await supabase.from('sms_gamev2_live_participants').update({ connected: false }).eq('id', participant.id)

  return NextResponse.json({ ok: true })
}
