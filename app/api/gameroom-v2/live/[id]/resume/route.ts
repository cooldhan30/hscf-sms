import { NextResponse } from 'next/server'
import { requireLiveSessionHost } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'
import { canResume } from '@/lib/gameRoomV2/liveClassroom/lifecycle'

// POST /api/gameroom-v2/live/[id]/resume -- host only. Resumes the live
// session AND shifts every participant's own question timer forward by
// exactly how long the pause lasted, so no participant silently loses
// remaining time to a teacher-initiated pause.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionHost(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, liveSession } = guard

  if (!canResume(liveSession.status)) {
    return NextResponse.json({ error: `Cannot resume -- live session is "${liveSession.status}"` }, { status: 409 })
  }

  const { error } = await supabase.rpc('sms_gamev2_resume_live_session', { p_live_session_id: liveSession.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ status: 'ACTIVE' })
}
