import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { repeatedQuestionMessage } from '@/lib/grClassic/server/db'
import { validateGame } from '@/lib/grClassic/validateGame'

// POST /api/gr-classic/games -- save a new game with its ordered
// questions in one step (sms_grc_save_game, migration 094). The database
// refuses questions that aren't the teacher's own or don't fit the type.
export async function POST(request: Request) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const v = validateGame(body)
  if (!v.ok) return NextResponse.json({ error: v.errors.join(' '), errors: v.errors }, { status: 400 })
  const g = v.value
  // A game never asks the same question twice.
  const repeated = await repeatedQuestionMessage(guard.supabase, g.questionIds)
  if (repeated) return NextResponse.json({ error: repeated }, { status: 400 })
  const { data, error } = await guard.supabase.rpc('sms_grc_save_game', {
    p_game_id: null,
    p_title: g.title,
    p_game_type: g.type,
    p_category_id: g.categoryId,
    p_difficulty: g.difficulty,
    p_live_seconds: g.liveSeconds,
    p_question_ids: g.questionIds,
  })
  if (error) return dbErrorResponse(error, 'create game')
  return NextResponse.json({ id: data as string }, { status: 201 })
}
