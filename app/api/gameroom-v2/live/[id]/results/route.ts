import { NextResponse } from 'next/server'
import { requireLiveSessionHost } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/gameroom-v2/live/[id]/results -- "Results" per the
// requirements list: the host's class-wide results view, built entirely
// from each participant's own (unmodified) sms_gamev2_sessions row --
// score/correct_count/answered_count/status -- joined back to the
// participant's nickname. Works whether the live session is still
// ACTIVE (a live-updating leaderboard) or ENDED (the final results
// screen); this route doesn't care which, it just reports whatever
// each participant's session currently shows.
//
// The participant roster is read through the host's own RLS client
// (that read is the authorization). The session rows are then read
// server-side, scoped to exactly the session ids that roster links to:
// the teacher's own RLS only covers sessions of sets THEY authored, so
// a host running a colleague's SCHOOL-shared set previously got an
// all-zero leaderboard. Only these ids are ever read.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionHost(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, liveSession } = guard

  const { data: participants } = await supabase
    .from('sms_gamev2_live_participants')
    .select('id, nickname, session_id')
    .eq('live_session_id', liveSession.id)

  const sessionIds = (participants ?? []).map((p) => p.session_id).filter((id): id is string => Boolean(id))

  const { data: sessions } =
    sessionIds.length > 0
      ? await createAdminClient()
          .from('sms_gamev2_sessions')
          .select('id, status, score, correct_count, answered_count, best_streak')
          .in('id', sessionIds)
          .eq('question_set_id', liveSession.question_set_id)
      : { data: [] }

  const sessionById = new Map((sessions ?? []).map((s) => [s.id, s]))

  const results = (participants ?? [])
    .map((p) => {
      const session = p.session_id ? sessionById.get(p.session_id) : null
      return {
        participantId: p.id,
        nickname: p.nickname,
        status: session?.status ?? 'NOT_STARTED',
        score: session?.score ?? 0,
        correctCount: session?.correct_count ?? 0,
        answeredCount: session?.answered_count ?? 0,
        bestStreak: session?.best_streak ?? 0,
      }
    })
    .sort((a, b) => b.score - a.score)

  return NextResponse.json({ liveSessionStatus: liveSession.status, results })
}
