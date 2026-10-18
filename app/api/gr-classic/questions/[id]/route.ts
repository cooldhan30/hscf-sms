import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { QUESTION_COLUMNS, categoryNames, listCategories, questionRow, rowToQuestion, teacherNames, type QuestionRow } from '@/lib/grClassic/server/db'
import { isUuid, validateQuestion } from '@/lib/grClassic/validateQuestion'

// PATCH  /api/gr-classic/questions/:id -- edit a question (its type can't
//        change). Games using it update too.
// DELETE /api/gr-classic/questions/:id -- archive it: it leaves the
//        library but saved games that use it keep working.
// The library is shared and any teacher may edit or archive any question
// (migration 100). A question keeps its author.
async function findQuestion(supabase: Parameters<typeof listCategories>[0], id: string) {
  const { data } = await supabase.from('sms_grc_questions').select('kind').eq('id', id).is('archived_at', null).maybeSingle()
  const q = data as { kind: string } | null
  if (!q) return { error: NextResponse.json({ error: 'Question not found.' }, { status: 404 }) }
  return { kind: q.kind }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const found = await findQuestion(guard.supabase, params.id)
  if (found.error) return found.error
  const v = validateQuestion({ ...body, kind: found.kind })
  if (!v.ok) return NextResponse.json({ error: v.errors.join(' '), errors: v.errors }, { status: 400 })

  const categories = await listCategories(guard.supabase, guard.userId)
  if (v.value.categoryId && !categories.some((c) => c.id === v.value.categoryId)) return NextResponse.json({ error: 'Topic not found.' }, { status: 400 })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { owner_id, ...changes } = questionRow(guard.userId, v.value)
  const { data, error } = await guard.supabase.from('sms_grc_questions').update(changes).eq('id', params.id).is('archived_at', null).select(QUESTION_COLUMNS).maybeSingle()
  if (error?.code === '23505') return NextResponse.json({ error: 'The same question is already in the library.' }, { status: 409 })
  if (error) return dbErrorResponse(error, 'edit question')
  if (!data) return NextResponse.json({ error: 'This question can’t be edited yet — ask an admin to apply the latest GameRoom Classic database update.' }, { status: 403 })
  const row = data as QuestionRow
  const authors = await teacherNames(guard.supabase, row.owner_id === guard.userId ? [] : [row.owner_id])
  return NextResponse.json({ question: rowToQuestion(row, categoryNames(categories), { userId: guard.userId, authors }) })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  const found = await findQuestion(guard.supabase, params.id)
  if (found.error) return found.error
  const { data, error } = await guard.supabase.from('sms_grc_questions').update({ archived_at: new Date().toISOString() }).eq('id', params.id).is('archived_at', null).select('id').maybeSingle()
  if (error) return dbErrorResponse(error, 'archive question')
  if (!data) return NextResponse.json({ error: 'This question can’t be archived yet — ask an admin to apply the latest GameRoom Classic database update.' }, { status: 403 })
  return NextResponse.json({ archived: true })
}
