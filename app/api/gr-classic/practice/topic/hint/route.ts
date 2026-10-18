import { NextResponse } from 'next/server'
import { hintFor } from '@/lib/grClassic/play'
import { readJson } from '@/lib/grClassic/server/auth'
import { errorResponse, grcStudentApi } from '@/lib/grClassic/server/studentAssignments'
import { libraryQuestion } from '@/lib/grClassic/server/topics'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/practice/topic/hint { questionId, matched? }
export async function POST(request: Request) {
  const guard = await grcStudentApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!isUuid(body?.questionId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const matched = Array.isArray(body?.matched) ? body.matched.filter((n: unknown): n is number => Number.isInteger(n)).slice(0, 10) : []
  try {
    return NextResponse.json(hintFor(await libraryQuestion(guard.admin, body.questionId as string), matched))
  } catch (e) {
    return errorResponse(e, 'topic practice hint')
  }
}
