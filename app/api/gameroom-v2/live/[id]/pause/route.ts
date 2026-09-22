import { NextResponse } from 'next/server'
import { requireLiveSessionHost } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'

// POST /api/gameroom-v2/live/[id]/pause -- host only. Pauses the live
// session AND every participant's own sms_gamev2_sessions row together,
// via one SECURITY DEFINER RPC (writing other users' session rows isn't
// something an ordinary RLS policy grants a teacher's client).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionHost(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, liveSession } = guard

  if (liveSession.status !== 'ACTIVE') {
    return NextResponse.json({ error: `Cannot pause -- live session is "${liveSession.status}"` }, { status: 409 })
  }

  const { error } = await supabase.rpc('sms_gamev2_pause_live_session', { p_live_session_id: liveSession.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ status: 'PAUSED' })
}
