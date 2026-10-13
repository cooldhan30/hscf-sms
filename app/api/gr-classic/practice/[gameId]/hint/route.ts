import { NextResponse } from 'next/server'
import { hintFor } from '@/lib/grClassic/play'
import { readJson } from '@/lib/grClassic/server/auth'
import { practiceGame } from '@/lib/grClassic/server/practice'
import { errorResponse, grcStudentApi } from '@/lib/grClassic/server/studentAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/practice/:gameId/hint { questionId, matched? }
export async function POST(request: Request, { params }: { params: { gameId: string } }) {
  const guard = await grcStudentApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!isUuid(params.gameId) || !isUuid(body?.questionId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const matched = Array.isArray(body?.matched) ? body.matched.filter((n: unknown): n is number => Number.isInteger(n)).slice(0, 10) : []
  try {
    const game = await practiceGame(guard.admin, guard.studentId, params.gameId)
    const question = game.questions.find((q) => q.id === body.questionId)
    if (!question) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    return NextResponse.json(hintFor(question, matched))
  } catch (e) {
    return errorResponse(e, 'practice hint')
  }
}
