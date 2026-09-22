import { NextResponse } from 'next/server'
import { requireLiveSessionHost } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'
import { isPresentlyConnected } from '@/lib/gameRoomV2/liveClassroom/presence'

// GET /api/gameroom-v2/live/[id]/lobby -- the teacher's own lobby/host
// view: live session status + the participant roster with presence.
// The teacher's client also subscribes to Realtime postgres_changes on
// both tables directly (see components/gameRoomV2/liveClassroom's host
// dashboard) for instant updates as students join -- this GET is only
// the initial load / a manual refresh fallback, not the primary
// update mechanism.
//
// Returns only `nickname` per participant, never the student's real
// name/email/profile -- "do not expose personal student information
// unnecessarily" applied to the teacher's OWN dashboard too, not just
// the shared classroom-visible roster (a teacher can already see a
// student's real name in the class roster elsewhere in the app; this
// view doesn't need to duplicate that).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionHost(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, liveSession } = guard

  const { data: participants } = await supabase
    .from('sms_gamev2_live_participants')
    .select('id, nickname, connected, last_seen_at, joined_at, session_id')
    .eq('live_session_id', liveSession.id)
    .order('joined_at', { ascending: true })

  return NextResponse.json({
    status: liveSession.status,
    joinCode: liveSession.join_code,
    engineId: liveSession.engine_id,
    participants: (participants ?? []).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      connected: isPresentlyConnected({ connected: p.connected, lastSeenAt: p.last_seen_at }),
      hasStarted: p.session_id !== null,
    })),
  })
}
