import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { QUESTION_COLUMNS, categoryNames, contentHash, listCategories, listQuestions, questionRow, rowToQuestion, type QuestionRow } from '@/lib/grClassic/server/db'
import { validateQuestion } from '@/lib/grClassic/validateQuestion'

// GET  /api/gr-classic/questions -- the teacher's library (not archived).
// POST /api/gr-classic/questions -- save one question. Saving a question
// the teacher already has returns the existing one ({ duplicate: true })
// instead of making a copy.
export async function GET() {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const names = categoryNames(await listCategories(guard.supabase, guard.userId))
  return NextResponse.json({ questions: await listQuestions(guard.supabase, names) })
}

export async function POST(request: Request) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const v = validateQuestion(body)
  if (!v.ok) return NextResponse.json({ error: v.errors.join(' '), errors: v.errors }, { status: 400 })

  const categories = await listCategories(guard.supabase, guard.userId)
  if (v.value.categoryId && !categories.some((c) => c.id === v.value.categoryId)) return NextResponse.json({ error: 'Topic not found.' }, { status: 400 })
  const names = categoryNames(categories)

  const { data, error } = await guard.supabase.from('sms_grc_questions').insert(questionRow(guard.userId, v.value)).select(QUESTION_COLUMNS).single()
  if (error?.code === '23505') {
    const { data: existing } = await guard.supabase
      .from('sms_grc_questions')
      .select(QUESTION_COLUMNS)
      .eq('content_key', contentHash(v.value.contentKey))
      .is('archived_at', null)
      .maybeSingle()
    if (existing) return NextResponse.json({ question: rowToQuestion(existing as QuestionRow, names), duplicate: true })
  }
  if (error) return dbErrorResponse(error, 'create question')
  return NextResponse.json({ question: rowToQuestion(data as QuestionRow, names) }, { status: 201 })
}
