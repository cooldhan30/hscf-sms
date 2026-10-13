import { NextResponse } from 'next/server'
import { playerState } from '@/lib/grClassic/server/live'
import { grcLivePlayer } from '@/lib/grClassic/server/liveAuth'
import { errorResponse } from '@/lib/grClassic/server/studentAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

export const dynamic = 'force-dynamic'

// GET /api/gr-classic/live/:id/me -- what this student's phone should show
// right now. Polled about once a second. No answer keys.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await grcLivePlayer()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Live game not found.' }, { status: 404 })
  try {
    return NextResponse.json(await playerState(guard.admin, params.id, guard.profileId), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return errorResponse(e, 'live state')
  }
}
