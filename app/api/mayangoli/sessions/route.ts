import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import {
  ALL_MAYANGOLI_WORDS,
  applyMayangoliWordOverrides,
  selectMayangoliWords,
  InvalidMayangoliConfigError,
  type MayangoliWordOverrideRow,
} from '@/lib/gameRoom/modules/mayangoli/selectWords'
import { MAYANGOLI_GROUPS } from '@/lib/gameRoom/modules/mayangoli/groups'
import type { MayangoliDifficulty } from '@/lib/gameRoom/modules/mayangoli/wordEntry'

const DIFFICULTIES: MayangoliDifficulty[] = ['easy', 'medium', 'hard']
const TIME_LIMITS = [10, 15, 20, 30] as const

// POST /api/mayangoli/sessions -- teacher-only. Creates a new Mayangoli
// session: resolves the requested groups/difficulty/count into a FIXED
// word set (randomization #1, persisted as question_ids -- every
// player in this session sees the identical room-wide question order,
// unlike the self-paced engine's per-player shuffled order), and
// persists the session in 'waiting' status.
export async function POST(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, teacher } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []

  const groupIds = Array.isArray(body.groupIds) ? body.groupIds.filter((g: unknown) => typeof g === 'string') : []
  const validGroupIds = MAYANGOLI_GROUPS.map((g) => g.id)
  if (groupIds.length === 0 || !groupIds.every((g: string) => validGroupIds.includes(g))) {
    errors.push(`Groups must be a non-empty list from: ${validGroupIds.join(', ')}`)
  }

  const difficulties = Array.isArray(body.difficulties)
    ? body.difficulties.filter((d: unknown) => typeof d === 'string')
    : []
  if (difficulties.length === 0 || !difficulties.every((d: string) => DIFFICULTIES.includes(d as MayangoliDifficulty))) {
    errors.push(`Difficulties must be a non-empty list from: ${DIFFICULTIES.join(', ')}`)
  }

  const count = Number(body.count)
  if (!Number.isInteger(count) || count < 5 || count > 50) {
    errors.push('Question count must be an integer between 5 and 50')
  }

  let timeLimitSeconds: (typeof TIME_LIMITS)[number] | undefined
  if (!TIME_LIMITS.includes(body.timeLimitSeconds)) {
    errors.push('Time limit must be one of: 10, 15, 20, 30')
  } else {
    timeLimitSeconds = body.timeLimitSeconds
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data: overrideRows } = await supabase.from('sms_mayangoli_word_overrides').select('*')
  const overriddenWords = applyMayangoliWordOverrides(ALL_MAYANGOLI_WORDS, (overrideRows ?? []) as MayangoliWordOverrideRow[])

  let words
  try {
    words = selectMayangoliWords({ groupIds, difficulties: difficulties as MayangoliDifficulty[], count }, overriddenWords)
  } catch (err) {
    if (err instanceof InvalidMayangoliConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const { data: session, error } = await supabase
    .from('sms_mayangoli_sessions')
    .insert([
      {
        host_teacher_id: teacher.id,
        question_ids: words.map((w) => w.id),
        question_time_limit_seconds: timeLimitSeconds,
      },
    ])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ sessionId: session.id, joinCode: session.join_code }, { status: 201 })
}
