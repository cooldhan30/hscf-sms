import { NextResponse } from 'next/server'
import { MAX_IMPORT_BYTES, MAX_IMPORT_SIZE_LABEL, readImport } from '@/lib/grClassic/csv'
import { planImport } from '@/lib/grClassic/importPlan'
import { validateQuestion } from '@/lib/grClassic/validateQuestion'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { QUESTION_COLUMNS, categoryNames, contentHash, listCategories, questionRow, rowToQuestion, type QuestionRow } from '@/lib/grClassic/server/db'

// POST /api/gr-classic/questions/import { csv, commit }
//   commit false -> preview: what each row will do (import / skip / error).
//                   "Skip" includes questions any teacher already added to
//                   the shared library.
//   commit true  -> imports the good rows (creating any new topics) and
//                   returns the new questions. Rows with errors or
//                   duplicates are never imported.
export async function POST(request: Request) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  const csv = typeof body?.csv === 'string' ? body.csv : ''
  if (!csv.trim()) return NextResponse.json({ error: 'Choose a CSV file first.' }, { status: 400 })
  if (Buffer.byteLength(csv, 'utf8') > MAX_IMPORT_BYTES) return NextResponse.json({ error: `That file is too big (max ${MAX_IMPORT_SIZE_LABEL}). Split it into smaller files.` }, { status: 400 })

  const parsed = readImport(csv)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { supabase, userId } = guard
  let categories = await listCategories(supabase, userId)
  // Only look up the fingerprints of the rows in this file (the shared
  // library can be far bigger than one query returns).
  const fileKeys = Array.from(new Set(parsed.rows.flatMap((r) => {
    const v = validateQuestion({ ...r.input, categoryId: null })
    return v.ok ? [contentHash(v.value.contentKey)] : []
  })))
  // In batches: a big file's fingerprints don't fit in one request (and a
  // failed lookup must stop the import, not let duplicates through).
  const existing = new Set<string>()
  for (let i = 0; i < fileKeys.length; i += 100) {
    const { data: keyRows, error: keyError } = await supabase.from('sms_grc_questions').select('content_key').in('content_key', fileKeys.slice(i, i + 100)).is('archived_at', null)
    if (keyError) return dbErrorResponse(keyError, 'check for duplicates')
    for (const r of (keyRows ?? []) as { content_key: string }[]) existing.add(r.content_key)
  }
  const plan = planImport(parsed.rows, existing, categories, contentHash)
  const counts = { ok: plan.filter((r) => r.status === 'ok').length, duplicate: plan.filter((r) => r.status === 'duplicate').length, error: plan.filter((r) => r.status === 'error').length }
  const preview = plan.map((r) => ({ line: r.line, status: r.status, errors: r.errors, summary: r.summary, topic: r.topic, newTopic: r.newTopic }))

  if (body?.commit !== true) return NextResponse.json({ kind: parsed.kind, rows: preview, counts })
  const toImport = plan.filter((r) => r.status === 'ok')
  if (toImport.length === 0) return NextResponse.json({ error: 'There are no new questions to import.' }, { status: 400 })

  // New topics first (one insert), then every question in one insert.
  const newTopics = Array.from(new Map(toImport.filter((r) => r.newTopic).map((r) => [r.topic.toLocaleLowerCase(), r.topic])).values())
  if (newTopics.length) {
    const { error } = await supabase.from('sms_grc_categories').insert(newTopics.map((name) => ({ name, owner_id: userId })))
    if (error && error.code !== '23505') return dbErrorResponse(error, 'import topics')
    categories = await listCategories(supabase, userId)
  }
  const topicId = new Map(categories.map((c) => [c.name.toLocaleLowerCase(), c.id]))
  const rows = toImport.map((r) => questionRow(userId, { ...r.value!, categoryId: r.topic ? (topicId.get(r.topic.toLocaleLowerCase()) ?? null) : null }))
  const { data, error } = await supabase.from('sms_grc_questions').insert(rows).select(QUESTION_COLUMNS)
  if (error?.code === '23505') return NextResponse.json({ error: 'Some of these questions were just added to your library. Check the file again and re-import.' }, { status: 409 })
  if (error) return dbErrorResponse(error, 'import questions')
  const names = categoryNames(categories)
  return NextResponse.json({ imported: data.length, skipped: counts.duplicate + counts.error, questions: (data as QuestionRow[]).map((q) => rowToQuestion(q, names, { userId })), categories }, { status: 201 })
}
