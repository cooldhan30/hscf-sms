import { NextResponse } from 'next/server'
import { checkResponse, isPlayResponse } from '@/lib/grClassic/play'
import { readJson } from '@/lib/grClassic/server/auth'
import { errorResponse, grcStudentApi } from '@/lib/grClassic/server/studentAssignments'
import { libraryQuestion } from '@/lib/grClassic/server/topics'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/practice/topic/check { questionId, response }
// A student playing a topic on their own: right or wrong, plus the right
// answer and explanation (it is practice). Nothing is stored.
export async function POST(request: Request) {
  const guard = await grcStudentApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!isUuid(body?.questionId) || !isPlayResponse(body?.response)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  try {
    return NextResponse.json(checkResponse(await libraryQuestion(guard.admin, body.questionId as string), body.response, true))
  } catch (e) {
    return errorResponse(e, 'topic practice check')
  }
}
