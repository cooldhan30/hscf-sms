import { NextResponse } from 'next/server'
import { requireLiveSessionHost } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'
import { isPresentlyConnected } from '@/lib/gameRoomV2/liveClassroom/presence'
import { shuffle } from '@/lib/gameRoomV2/shuffle'

// POST /api/gameroom-v2/live/[id]/start -- "Teacher starts game", host
// only. Shuffles the question order ONCE here (every participant plays
// the identical order, unlike solo sessions which each shuffle their
// own copy) and calls the SECURITY DEFINER RPC that atomically creates
// every currently-connected participant's own sms_gamev2_sessions row
// and flips the live session to ACTIVE. A student who joined the lobby
// but disconnected before start is simply not started (their
// participant row keeps session_id NULL) -- they can still reconnect
// later via /join, at which point they'd see the live session is no
// longer LOBBY and get a clear "already started" message, matching
// legacy GameRoom's own "can't join once active" rule.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionHost(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, liveSession } = guard

  if (liveSession.status !== 'LOBBY') {
    return NextResponse.json({ error: `Cannot start -- live session is "${liveSession.status}"` }, { status: 409 })
  }

  const { data: participants } = await supabase
    .from('sms_gamev2_live_participants')
    .select('id, connected, last_seen_at')
    .eq('live_session_id', liveSession.id)

  const connectedParticipantIds = (participants ?? [])
    .filter((p) => isPresentlyConnected({ connected: p.connected, lastSeenAt: p.last_seen_at }))
    .map((p) => p.id)

  if (connectedParticipantIds.length === 0) {
    return NextResponse.json({ error: 'No students are currently in the lobby' }, { status: 409 })
  }

  const { data: questions } = await supabase.from('sms_gamev2_questions').select('id').eq('question_set_id', liveSession.question_set_id)
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'This question set has no questions' }, { status: 409 })
  }

  const questionOrder = shuffle(questions.map((q) => q.id))

  const { data: startedCount, error } = await supabase.rpc('sms_gamev2_start_live_session', {
    p_live_session_id: liveSession.id,
    p_question_order: questionOrder,
    p_participant_ids: connectedParticipantIds,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ startedCount })
}
