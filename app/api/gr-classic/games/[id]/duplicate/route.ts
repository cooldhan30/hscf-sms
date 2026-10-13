import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi } from '@/lib/grClassic/server/auth'
import { categoryNames, getGame, listCategories } from '@/lib/grClassic/server/db'
import { isUuid } from '@/lib/grClassic/validateQuestion'
import type { GameSummary } from '@/lib/grClassic/types'

// POST /api/gr-classic/games/:id/duplicate -- a copy of one of the
// teacher's games, using the same questions, named "… (copy)".
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
  const names = categoryNames(await listCategories(guard.supabase, guard.userId))
  const game = await getGame(guard.supabase, params.id, names)
  if (!game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })

  const title = `${game.title.slice(0, 113)} (copy)`
  const { data, error } = await guard.supabase.rpc('sms_grc_save_game', {
    p_game_id: null,
    p_title: title,
    p_game_type: game.type,
    p_category_id: game.categoryId ?? null,
    p_difficulty: game.difficulty,
    p_live_seconds: game.liveSeconds,
    p_question_ids: game.questions.map((q) => q.id),
  })
  if (error) return dbErrorResponse(error, 'duplicate game')
  const copy: GameSummary = { id: data as string, title, type: game.type, category: game.category, questionCount: game.questions.length, updatedAt: new Date().toISOString(), practice: true }
  return NextResponse.json({ game: copy }, { status: 201 })
}
