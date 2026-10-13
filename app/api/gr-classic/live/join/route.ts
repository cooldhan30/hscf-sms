import { NextResponse } from 'next/server'
import { normalizePin } from '@/lib/grClassic/live'
import { readJson } from '@/lib/grClassic/server/auth'
import { joinLive } from '@/lib/grClassic/server/live'
import { errorResponse, grcStudentApi } from '@/lib/grClassic/server/studentAssignments'

// POST /api/gr-classic/live/join { pin } -- a signed-in student joins a
// live game for a class they are enrolled in. Joining again returns the
// same player (refresh, or a new phone).
export async function POST(request: Request) {
  const guard = await grcStudentApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  const pin = normalizePin(body?.pin)
  if (pin.length !== 6) return NextResponse.json({ error: 'A game PIN has 6 numbers.' }, { status: 400 })
  try {
    return NextResponse.json(await joinLive(guard.admin, { id: guard.studentId, profileId: guard.profileId, firstName: guard.firstName, lastName: guard.lastName }, pin))
  } catch (e) {
    return errorResponse(e, 'join live game')
  }
}
