import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { LEVEL_CONFIGS } from '@/lib/gameRoom/modules/tamilWordFormation/levels'
import type { WordComplexity } from '@/lib/gameRoom/modules/tamilWordFormation/words'

// GET /api/game-room/word-formation/progress -- student-only. Returns
// the caller's highest-unlocked level per complexity. A student who
// has never touched a complexity has no row yet -- treated as
// highest_unlocked = 1 (level 1 of every complexity starts unlocked by
// default, per spec), so the client never needs to special-case "no
// row" vs "row with 1".
export async function GET() {
  const guard = await requireStudent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, student } = guard

  const { data: rows, error } = await supabase
    .from('sms_word_formation_progress')
    .select('complexity, highest_unlocked')
    .eq('student_id', student.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const highestUnlocked: Record<WordComplexity, number> = { easy: 1, medium: 1, hard: 1 }
  for (const row of rows ?? []) {
    highestUnlocked[row.complexity as WordComplexity] = row.highest_unlocked
  }

  return NextResponse.json({ highestUnlocked, levels: LEVEL_CONFIGS })
}
