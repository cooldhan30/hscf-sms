import { NextResponse } from 'next/server'
import { requireLiveSessionHost } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'
import { isPresentlyConnected } from '@/lib/gameRoomV2/liveClassroom/presence'
import { isLiveSessionStale } from '@/lib/gameRoomV2/liveClassroom/lifecycle'
import { deriveLiveNickname } from '@/lib/gameRoomV2/liveClassroom'
import { getGameEngineV2 } from '@/lib/gameRoomV2/registry'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/gameroom-v2/live/[id]/lobby -- the host's view of their own
// live session: join code, status, who has joined, AND the class roster
// (every actively enrolled student, joined or not) so the teacher can
// see at a glance who is still missing. Host-only (requireLiveSessionHost
// + RLS "host teacher read own"); the roster/title lookups run through
// the admin client only after that guard succeeded, and return names
// only -- never anything answer-related.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionHost(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, liveSession } = guard
  const admin = createAdminClient()

  const [{ data: participants }, { data: enrollments }, { data: klass }, { data: set }] = await Promise.all([
    supabase
      .from('sms_gamev2_live_participants')
      .select('id, student_id, nickname, connected, last_seen_at, joined_at, session_id')
      .eq('live_session_id', liveSession.id)
      .order('joined_at', { ascending: true }),
    admin.from('sms_class_enrollments').select('student_id, student:sms_students!student_id(first_name, last_name)').eq('class_id', liveSession.class_id).eq('status', 'active'),
    admin.from('sms_classes').select('name').eq('id', liveSession.class_id).maybeSingle(),
    admin.from('sms_gamev2_question_sets').select('title, tamil_title, question_count').eq('id', liveSession.question_set_id).maybeSingle(),
  ])

  const byStudent = new Map((participants ?? []).map((p) => [p.student_id as string, p]))
  const roster = (enrollments ?? [])
    .map((e) => {
      const st = (Array.isArray(e.student) ? e.student[0] : e.student) as { first_name: string | null; last_name: string | null } | null
      const p = byStudent.get(e.student_id as string)
      return {
        studentId: e.student_id as string,
        name: deriveLiveNickname(st?.first_name ?? null, st?.last_name ?? null),
        joined: !!p,
        connected: p ? isPresentlyConnected({ connected: p.connected, lastSeenAt: p.last_seen_at }) : false,
        playing: p ? p.session_id !== null : false,
      }
    })
    .sort((a, b) => Number(b.joined) - Number(a.joined) || a.name.localeCompare(b.name))

  return NextResponse.json({
    status: liveSession.status,
    joinCode: liveSession.join_code,
    engineId: liveSession.engine_id,
    engineName: getGameEngineV2(liveSession.engine_id)?.name ?? liveSession.engine_id,
    className: klass?.name ?? null,
    questionSetTitle: set?.tamil_title || set?.title || null,
    questionCount: liveSession.question_count ?? set?.question_count ?? null,
    stale: isLiveSessionStale(liveSession.status, liveSession.created_at),
    roster,
    participants: (participants ?? []).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      connected: isPresentlyConnected({ connected: p.connected, lastSeenAt: p.last_seen_at }),
      hasStarted: p.session_id !== null,
    })),
  })
}
