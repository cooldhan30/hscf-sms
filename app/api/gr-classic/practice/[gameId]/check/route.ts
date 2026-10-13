import { NextResponse } from 'next/server'
import { checkResponse, isPlayResponse } from '@/lib/grClassic/play'
import { readJson } from '@/lib/grClassic/server/auth'
import { practiceGame } from '@/lib/grClassic/server/practice'
import { errorResponse, grcStudentApi } from '@/lib/grClassic/server/studentAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/practice/:gameId/check { questionId, response }
// Practice: right or wrong, plus the right answer and explanation (it is
// practice, so the answer is shown). Nothing is stored.
export async function POST(request: Request, { params }: { params: { gameId: string } }) {
  const guard = await grcStudentApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!isUuid(params.gameId) || !isUuid(body?.questionId) || !isPlayResponse(body?.response)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  try {
    const game = await practiceGame(guard.admin, guard.studentId, params.gameId)
    const question = game.questions.find((q) => q.id === body.questionId)
    if (!question) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    return NextResponse.json(checkResponse(question, body.response, true))
  } catch (e) {
    return errorResponse(e, 'practice check')
  }
}
