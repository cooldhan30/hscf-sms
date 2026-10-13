import { NextResponse } from 'next/server'
import { checkResponse, isPlayResponse } from '@/lib/grClassic/play'
import { grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { getGameQuestion } from '@/lib/grClassic/server/db'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/games/:id/check { questionId, response }
// Teacher preview of their own saved game: checks one answer on the
// server, exactly as students' games will (answers never sent ahead).
// Students get their own attempt-bound version in Phases 4-6.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!isUuid(params.id) || !isUuid(body?.questionId) || !isPlayResponse(body?.response)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const question = await getGameQuestion(guard.supabase, params.id, body.questionId)
  if (!question) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  return NextResponse.json(checkResponse(question, body.response, true))
}
