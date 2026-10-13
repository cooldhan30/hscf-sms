import { NextResponse } from 'next/server'
import { isPlayResponse } from '@/lib/grClassic/play'
import { readJson } from '@/lib/grClassic/server/auth'
import { answerLive } from '@/lib/grClassic/server/live'
import { grcLivePlayer } from '@/lib/grClassic/server/liveAuth'
import { errorResponse } from '@/lib/grClassic/server/studentAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/live/:id/answer { questionId, response }
// One answer from a player. The server checks the clock and scores it;
// the first answer to a question is the one that counts.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await grcLivePlayer()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!isUuid(params.id) || !isUuid(body?.questionId) || !isPlayResponse(body?.response)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  try {
    return NextResponse.json(await answerLive(guard.admin, params.id, guard.profileId, body.questionId, body.response))
  } catch (e) {
    return errorResponse(e, 'live answer')
  }
}
