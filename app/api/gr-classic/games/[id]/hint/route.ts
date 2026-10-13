import { NextResponse } from 'next/server'
import { hintFor } from '@/lib/grClassic/play'
import { grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { getGameQuestion } from '@/lib/grClassic/server/db'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/games/:id/hint { questionId, matched? }
// A practice-style hint for the teacher previewing their own saved game.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!isUuid(params.id) || !isUuid(body?.questionId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const matched = Array.isArray(body?.matched) ? body.matched.filter((n: unknown): n is number => Number.isInteger(n)).slice(0, 10) : []
  const question = await getGameQuestion(guard.supabase, params.id, body.questionId)
  if (!question) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  return NextResponse.json(hintFor(question, matched))
}
