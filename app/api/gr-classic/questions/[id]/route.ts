import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { QUESTION_COLUMNS, categoryNames, listCategories, questionRow, rowToQuestion, type QuestionRow } from '@/lib/grClassic/server/db'
import { isUuid, validateQuestion } from '@/lib/grClassic/validateQuestion'

// PATCH  /api/gr-classic/questions/:id -- edit one of the teacher's
//        questions (its type can't change). Games using it update too.
// DELETE /api/gr-classic/questions/:id -- archive it: it leaves the
//        library but saved games that use it keep working.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { data: current } = await guard.supabase.from('sms_grc_questions').select('kind').eq('id', params.id).is('archived_at', null).maybeSingle()
  if (!current) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  const v = validateQuestion({ ...body, kind: current.kind })
  if (!v.ok) return NextResponse.json({ error: v.errors.join(' '), errors: v.errors }, { status: 400 })

  const categories = await listCategories(guard.supabase, guard.userId)
  if (v.value.categoryId && !categories.some((c) => c.id === v.value.categoryId)) return NextResponse.json({ error: 'Topic not found.' }, { status: 400 })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { owner_id, ...changes } = questionRow(guard.userId, v.value)
  const { data, error } = await guard.supabase.from('sms_grc_questions').update(changes).eq('id', params.id).is('archived_at', null).select(QUESTION_COLUMNS).maybeSingle()
  if (error) return dbErrorResponse(error, 'edit question')
  if (!data) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  return NextResponse.json({ question: rowToQuestion(data as QuestionRow, categoryNames(categories)) })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  const { data, error } = await guard.supabase.from('sms_grc_questions').update({ archived_at: new Date().toISOString() }).eq('id', params.id).is('archived_at', null).select('id').maybeSingle()
  if (error) return dbErrorResponse(error, 'archive question')
  if (!data) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  return NextResponse.json({ archived: true })
}
