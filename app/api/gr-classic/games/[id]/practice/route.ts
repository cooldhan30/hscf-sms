import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// PATCH /api/gr-classic/games/:id/practice { practice: boolean }
// Lets (or stops) the teacher's students practising this game.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!isUuid(params.id) || typeof body?.practice !== 'boolean') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { data, error } = await guard.supabase.from('sms_grc_games').update({ practice: body.practice }).eq('id', params.id).is('archived_at', null).select('practice').maybeSingle()
  if (error) return dbErrorResponse(error, 'practice switch')
  if (!data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
  return NextResponse.json({ practice: data.practice })
}
