import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { QUESTION_COLUMNS, categoryNames, listCategories, questionRow, rowToQuestion, type QuestionRow } from '@/lib/grClassic/server/db'
import { isUuid, validateQuestion } from '@/lib/grClassic/validateQuestion'

// PATCH  /api/gr-classic/questions/:id -- edit a question (its type can't
//        change). Games using it update too.
// DELETE /api/gr-classic/questions/:id -- archive it: it leaves the
//        library but saved games that use it keep working.
// The library is shared, but only the teacher who wrote a question may
// change or archive it (also enforced by RLS, migration 094).
const NOT_YOURS = 'Only the teacher who wrote this question can change it. You can still use it in your games.'

async function ownQuestion(supabase: Parameters<typeof listCategories>[0], id: string, userId: string) {
  const { data } = await supabase.from('sms_grc_questions').select('kind, owner_id').eq('id', id).is('archived_at', null).maybeSingle()
  const q = data as { kind: string; owner_id: string } | null
  if (!q) return { error: NextResponse.json({ error: 'Question not found.' }, { status: 404 }) }
  if (q.owner_id !== userId) return { error: NextResponse.json({ error: NOT_YOURS }, { status: 403 }) }
  return { kind: q.kind }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const own = await ownQuestion(guard.supabase, params.id, guard.userId)
  if (own.error) return own.error
  const v = validateQuestion({ ...body, kind: own.kind })
  if (!v.ok) return NextResponse.json({ error: v.errors.join(' '), errors: v.errors }, { status: 400 })

  const categories = await listCategories(guard.supabase, guard.userId)
  if (v.value.categoryId && !categories.some((c) => c.id === v.value.categoryId)) return NextResponse.json({ error: 'Topic not found.' }, { status: 400 })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { owner_id, ...changes } = questionRow(guard.userId, v.value)
  const { data, error } = await guard.supabase.from('sms_grc_questions').update(changes).eq('id', params.id).eq('owner_id', guard.userId).is('archived_at', null).select(QUESTION_COLUMNS).maybeSingle()
  if (error) return dbErrorResponse(error, 'edit question')
  if (!data) return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
  return NextResponse.json({ question: rowToQuestion(data as QuestionRow, categoryNames(categories), { userId: guard.userId }) })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  const own = await ownQuestion(guard.supabase, params.id, guard.userId)
  if (own.error) return own.error
  const { data, error } = await guard.supabase.from('sms_grc_questions').update({ archived_at: new Date().toISOString() }).eq('id', params.id).eq('owner_id', guard.userId).is('archived_at', null).select('id').maybeSingle()
  if (error) return dbErrorResponse(error, 'archive question')
  if (!data) return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
  return NextResponse.json({ archived: true })
}
