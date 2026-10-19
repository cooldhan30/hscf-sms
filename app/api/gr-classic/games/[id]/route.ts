import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { repeatedQuestionMessage } from '@/lib/grClassic/server/db'
import { validateGame } from '@/lib/grClassic/validateGame'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// PATCH  /api/gr-classic/games/:id -- save changes (name, topic, settings,
//        questions and their order) in one step. The type can't change.
// DELETE /api/gr-classic/games/:id -- archive the game (hidden, not erased).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const v = validateGame(body)
  if (!v.ok) return NextResponse.json({ error: v.errors.join(' '), errors: v.errors }, { status: 400 })
  const g = v.value
  // A game never asks the same question twice.
  const repeated = await repeatedQuestionMessage(guard.supabase, g.questionIds)
  if (repeated) return NextResponse.json({ error: repeated }, { status: 400 })
  const { data, error } = await guard.supabase.rpc('sms_grc_save_game', {
    p_game_id: params.id,
    p_title: g.title,
    p_game_type: g.type,
    p_category_id: g.categoryId,
    p_difficulty: g.difficulty,
    p_live_seconds: g.liveSeconds,
    p_question_ids: g.questionIds,
  })
  if (error) return dbErrorResponse(error, 'save game')
  return NextResponse.json({ id: data as string })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
  const { data, error } = await guard.supabase.from('sms_grc_games').update({ archived_at: new Date().toISOString() }).eq('id', params.id).is('archived_at', null).select('id').maybeSingle()
  if (error) return dbErrorResponse(error, 'archive game')
  if (!data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
  return NextResponse.json({ archived: true })
}
