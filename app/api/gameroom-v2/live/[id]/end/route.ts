import { NextResponse } from 'next/server'
import { requireLiveSessionHost } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'
import { canEnd } from '@/lib/gameRoomV2/liveClassroom/lifecycle'

// POST /api/gameroom-v2/live/[id]/end -- host only, "End" per the
// requirements list. Callable from LOBBY, ACTIVE, or PAUSED -- a
// teacher can end a live session before it even starts (e.g. wrong
// question set selected) just as validly as mid-game. Abandons every
// participant's still-incomplete individual session; a participant who
// already finished on their own keeps their real, untouched results.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionHost(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, liveSession } = guard

  if (!canEnd(liveSession.status)) {
    return NextResponse.json({ error: 'This live session has already ended' }, { status: 409 })
  }

  const { error } = await supabase.rpc('sms_gamev2_end_live_session', { p_live_session_id: liveSession.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ status: 'ENDED' })
}
