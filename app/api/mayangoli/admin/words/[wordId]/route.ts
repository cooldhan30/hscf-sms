import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { ALL_MAYANGOLI_WORDS_INCLUDING_DISABLED } from '@/lib/gameRoom/modules/mayangoli/selectWords'

const REVIEW_STATUSES = ['generated', 'reviewed', 'approved'] as const

// PATCH /api/mayangoli/admin/words/[wordId] -- any teacher. Body: any
// subset of { reviewStatus, enabled, meaningEnglish, meaningTamil }.
// Upserts one row in sms_mayangoli_word_overrides -- the static word
// bank file itself is never written to at runtime; this only ever
// touches the DB-side override layer (see selectWords.ts).
export async function PATCH(request: Request, { params }: { params: { wordId: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, teacher } = guard

  const wordExists = ALL_MAYANGOLI_WORDS_INCLUDING_DISABLED.some((w) => w.id === params.wordId)
  if (!wordExists) {
    return NextResponse.json({ error: 'Unknown word id' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // upsert() replaces the whole row on conflict (it's not a partial
  // merge), so an existing override row's other fields are fetched
  // first and carried forward -- otherwise e.g. enabling a word here
  // would silently wipe out a previously-set reviewStatus/meaning edit.
  const { data: existing } = await supabase
    .from('sms_mayangoli_word_overrides')
    .select('*')
    .eq('word_id', params.wordId)
    .maybeSingle()

  const update: Record<string, unknown> = {
    word_id: params.wordId,
    review_status: existing?.review_status ?? null,
    enabled: existing?.enabled ?? null,
    meaning_english_override: existing?.meaning_english_override ?? null,
    meaning_tamil_override: existing?.meaning_tamil_override ?? null,
    updated_at: new Date().toISOString(),
    reviewed_by: teacher.id,
  }

  if (body.reviewStatus !== undefined) {
    if (!REVIEW_STATUSES.includes(body.reviewStatus)) {
      return NextResponse.json({ error: `reviewStatus must be one of: ${REVIEW_STATUSES.join(', ')}` }, { status: 400 })
    }
    update.review_status = body.reviewStatus
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
    }
    update.enabled = body.enabled
  }
  if (body.meaningEnglish !== undefined) {
    if (typeof body.meaningEnglish !== 'string' || body.meaningEnglish.trim().length === 0) {
      return NextResponse.json({ error: 'meaningEnglish must be a non-empty string' }, { status: 400 })
    }
    update.meaning_english_override = body.meaningEnglish.trim()
  }
  if (body.meaningTamil !== undefined) {
    update.meaning_tamil_override = typeof body.meaningTamil === 'string' && body.meaningTamil.trim() ? body.meaningTamil.trim() : null
  }

  const { error } = await supabase.from('sms_mayangoli_word_overrides').upsert([update], { onConflict: 'word_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
