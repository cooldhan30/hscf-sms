import { NextResponse } from 'next/server'
import { requireLiveSessionParticipant } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'
import { isPresentlyConnected } from '@/lib/gameRoomV2/liveClassroom/presence'
import { isLiveSessionStale } from '@/lib/gameRoomV2/liveClassroom/lifecycle'

// GET /api/gameroom-v2/live/[id]/state -- the student's own lobby/play
// view: live session status, the roster (nicknames only), and -- once
// the host has started the game -- this participant's OWN
// sessionId, the bridge into the existing, completely unmodified solo
// gameplay stack (GameSessionRuntime / sessions/[id]/state / answer /
// complete). Live Classroom's job ends the moment sessionId is handed
// off; from then on, this participant's actual play experience is
// IDENTICAL to a solo student's, engine-for-engine.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionParticipant(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, liveSession, participant } = guard

  const { data: participants } = await supabase
    .from('sms_gamev2_live_participants')
    .select('nickname, connected, last_seen_at')
    .eq('live_session_id', liveSession.id)
    .order('joined_at', { ascending: true })

  return NextResponse.json({
    status: liveSession.status,
    engineId: liveSession.engine_id,
    sessionId: participant.session_id,
    participantId: participant.id,
    // Only meaningful for racing (see migration 081's race_difficulty
    // column) -- every other engine's live session just carries the
    // table's default, unused by that engine's client.
    raceDifficulty: liveSession.race_difficulty,
    // HOST DISCONNECT / STALE ROOM: a student stuck in the lobby (or
    // an ACTIVE session with no bridge row yet) whose host tab closed
    // and never returned would otherwise poll forever with no signal
    // anything is wrong -- this flag lets LivePlayClient.tsx show a
    // clear "this session has gone stale" message instead of an
    // indefinite spinner. See lifecycle.ts's isLiveSessionStale.
    stale: isLiveSessionStale(liveSession.status, liveSession.created_at),
    roster: (participants ?? []).map((p) => ({
      nickname: p.nickname,
      connected: isPresentlyConnected({ connected: p.connected, lastSeenAt: p.last_seen_at }),
    })),
  })
}
