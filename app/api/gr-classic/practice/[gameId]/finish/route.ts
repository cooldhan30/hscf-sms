import { NextResponse } from 'next/server'
import { readJson } from '@/lib/grClassic/server/auth'
import { practiceGame, recordPractice } from '@/lib/grClassic/server/practice'
import { errorResponse, grcStudentApi } from '@/lib/grClassic/server/studentAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/practice/:gameId/finish { percent }
// Saves practice progress (plays, best score). Encouragement only; never a grade.
export async function POST(request: Request, { params }: { params: { gameId: string } }) {
  const guard = await grcStudentApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!isUuid(params.gameId) || typeof body?.percent !== 'number' || !Number.isFinite(body.percent)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  try {
    await practiceGame(guard.admin, guard.studentId, params.gameId)
    return NextResponse.json(await recordPractice(guard.admin, guard.studentId, params.gameId, body.percent))
  } catch (e) {
    return errorResponse(e, 'practice finish')
  }
}
