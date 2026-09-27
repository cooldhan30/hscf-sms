import { NextResponse } from 'next/server'
import { requireLiveSessionParticipant } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'
import { isPresentlyConnected } from '@/lib/gameRoomV2/liveClassroom/presence'
import { isLiveSessionStale } from '@/lib/gameRoomV2/liveClassroom/lifecycle'
import { deriveLiveNickname } from '@/lib/gameRoomV2/liveClassroom'
import { getGameEngineV2 } from '@/lib/gameRoomV2/registry'

// GET /api/gameroom-v2/live/[id]/state -- a joined student's view of the
// live session: status, their own sessionId once the host starts, the
// lobby roster (nicknames only), and what they are about to play
// (teacher, class, question-set title, game). Participant-only
// (requireLiveSessionParticipant). The display lookups use the admin
// client only after that guard, and only read names/titles -- never a
// question, payload or answer.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionParticipant(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, admin, liveSession, participant } = guard

  const [{ data: participants }, { data: klass }, { data: set }, { data: host }] = await Promise.all([
    supabase
      .from('sms_gamev2_live_participants')
      .select('nickname, connected, last_seen_at')
      .eq('live_session_id', liveSession.id)
      .order('joined_at', { ascending: true }),
    admin.from('sms_classes').select('name').eq('id', liveSession.class_id).maybeSingle(),
    admin.from('sms_gamev2_question_sets').select('title, tamil_title').eq('id', liveSession.question_set_id).maybeSingle(),
    admin.from('sms_teachers').select('profile:sms_profiles!profile_id(first_name, last_name)').eq('id', liveSession.host_teacher_id).maybeSingle(),
  ])
  const hp = (host && (Array.isArray(host.profile) ? host.profile[0] : host.profile)) as { first_name: string | null; last_name: string | null } | null
  const engine = getGameEngineV2(liveSession.engine_id)

  return NextResponse.json({
    status: liveSession.status,
    engineId: liveSession.engine_id,
    engineName: engine?.name ?? liveSession.engine_id,
    engineTamilName: engine?.tamilName ?? null,
    sessionId: participant.session_id,
    participantId: participant.id,
    raceDifficulty: liveSession.race_difficulty,
    bossId: liveSession.boss_id,
    bossDifficulty: liveSession.boss_difficulty,
    stale: isLiveSessionStale(liveSession.status, liveSession.created_at),
    className: klass?.name ?? null,
    questionSetTitle: set?.tamil_title || set?.title || null,
    teacherName: hp ? deriveLiveNickname(hp.first_name, hp.last_name) : null,
    roster: (participants ?? []).map((p) => ({
      nickname: p.nickname,
      connected: isPresentlyConnected({ connected: p.connected, lastSeenAt: p.last_seen_at }),
    })),
  })
}
