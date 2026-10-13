import { NextResponse } from 'next/server'
import { isPlayResponse } from '@/lib/grClassic/play'
import { readJson } from '@/lib/grClassic/server/auth'
import { checkInAttempt, errorResponse, grcStudentApi } from '@/lib/grClassic/server/studentAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/attempts/:id/check { questionId, response }
// Stores and grades one answer in the student's own attempt. Says only
// right or wrong -- never the right answer.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await grcStudentApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!isUuid(params.id) || !isUuid(body?.questionId) || !isPlayResponse(body?.response)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  try {
    return NextResponse.json(await checkInAttempt(guard.admin, guard.studentId, params.id, body.questionId, body.response))
  } catch (e) {
    return errorResponse(e, 'check answer')
  }
}
