import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { QUESTION_COLUMNS, categoryNames, contentHash, listCategories, questionRow, rowToQuestion, searchLibrary, teacherNames, type QuestionRow } from '@/lib/grClassic/server/db'
import { isUuid, validateQuestion } from '@/lib/grClassic/validateQuestion'

// GET  /api/gr-classic/questions?kind=&topic=&mine=&q=&offset=
//      one page of the shared library (newest first) for the Question
//      Library page, with the total that matches. topic: a topic id,
//      "none" (no topic) or empty (all); mine=1 = only my questions.
// POST /api/gr-classic/questions -- save one question. If the same
//      question is already in the shared library (by anyone), that one is
//      returned ({ duplicate: true }) instead of making a copy.
const KINDS = ['choice', 'match', 'order'] as const
export async function GET(request: Request) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const p = new URL(request.url).searchParams
  const kind = KINDS.find((k) => k === p.get('kind')) ?? 'choice'
  const topic = p.get('topic') ?? ''
  if (topic && topic !== 'none' && !isUuid(topic)) return NextResponse.json({ error: 'Topic not found.' }, { status: 400 })
  const offset = Math.min(Math.max(Number.parseInt(p.get('offset') ?? '0', 10) || 0, 0), 100_000)
  try {
    // Read by the server: every teacher may read the whole library, and
    // this spares a permission check on every row.
    const admin = createAdminClient()
    const names = categoryNames(await listCategories(admin, guard.userId))
    return NextResponse.json(await searchLibrary(admin, names, guard.userId, { kind, topic, mine: p.get('mine') === '1', search: p.get('q') ?? '', offset }))
  } catch (e) {
    return dbErrorResponse(e as { code?: string; message?: string }, 'load questions')
  }
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

  const existing = async () => {
    const { data } = await guard.supabase.from('sms_grc_questions').select(QUESTION_COLUMNS).eq('content_key', contentHash(v.value.contentKey)).is('archived_at', null).order('created_at').limit(1)
    const row = (data as QuestionRow[] | null)?.[0]
    if (!row) return null
    const authors = await teacherNames(guard.supabase, row.owner_id === guard.userId ? [] : [row.owner_id])
    return NextResponse.json({ question: rowToQuestion(row, names, { userId: guard.userId, authors }), duplicate: true })
  }
  const found = await existing()
  if (found) return found

  const { data, error } = await guard.supabase.from('sms_grc_questions').insert(questionRow(guard.userId, v.value)).select(QUESTION_COLUMNS).single()
  if (error?.code === '23505') return (await existing()) ?? dbErrorResponse(error, 'create question')
  if (error) return dbErrorResponse(error, 'create question')
  return NextResponse.json({ question: rowToQuestion(data as QuestionRow, names, { userId: guard.userId }) }, { status: 201 })
}
