import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import {
  ALL_MAYANGOLI_WORDS_INCLUDING_DISABLED,
  applyMayangoliWordOverrides,
  type MayangoliWordOverrideRow,
} from '@/lib/gameRoom/modules/mayangoli/selectWords'

// GET /api/mayangoli/admin/words -- any teacher. Returns the full
// 315-word bank with admin overrides (enabled/reviewStatus/meaning
// edits) already merged in, for the question-bank admin screen's
// search/filter/browse table.
export async function GET() {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const { data: overrideRows } = await supabase.from('sms_mayangoli_word_overrides').select('*')
  const words = applyMayangoliWordOverrides(ALL_MAYANGOLI_WORDS_INCLUDING_DISABLED, (overrideRows ?? []) as MayangoliWordOverrideRow[])

  return NextResponse.json({
    words: words.map((w) => ({
      id: w.id,
      word: w.word,
      targetLetter: w.targetLetter,
      groupId: w.groupId,
      difficulty: w.difficulty,
      meaningEnglish: w.meaningEnglish,
      meaningTamil: w.meaningTamil ?? null,
      reviewStatus: w.reviewStatus,
      enabled: w.enabled,
    })),
  })
}
