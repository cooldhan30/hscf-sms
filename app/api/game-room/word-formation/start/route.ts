import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { getLevelConfig, levelPositionWithinComplexity } from '@/lib/gameRoom/modules/tamilWordFormation/levels'
import { generateLevelPuzzles } from '@/lib/gameRoom/modules/tamilWordFormation/puzzle'

// POST /api/game-room/word-formation/start -- student-only. Body:
// { level }. Unlike every other interactive game's /start, this
// checks the level is actually unlocked for this student
// (sms_word_formation_progress) before generating anything -- a
// student can't skip ahead by guessing a session-start call for a
// level they haven't reached, since level-gating is the whole point of
// this table. Board data (5 shuffled word puzzles, each with its own
// shuffled tile set) is generated fresh every call, same "generate
// once, hand to client, never re-fetch mid-play" pattern as every
// other interactive game here.
export async function POST(request: Request) {
  const guard = await requireStudent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, student } = guard

  const body = await request.json().catch(() => null)
  const level = Number(body?.level)
  if (!Number.isInteger(level) || level < 1) {
    return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
  }

  const config = getLevelConfig(level)
  if (!config) {
    return NextResponse.json({ error: `Unknown level: ${level}` }, { status: 400 })
  }

  const position = levelPositionWithinComplexity(level)
  if (position === null) {
    return NextResponse.json({ error: `Unknown level: ${level}` }, { status: 400 })
  }

  const { data: progress } = await supabase
    .from('sms_word_formation_progress')
    .select('highest_unlocked')
    .eq('student_id', student.id)
    .eq('complexity', config.complexity)
    .maybeSingle()

  const highestUnlocked = progress?.highest_unlocked ?? 1
  if (position > highestUnlocked) {
    return NextResponse.json({ error: 'This level is locked' }, { status: 403 })
  }

  const puzzleData = generateLevelPuzzles(level)
  if (!puzzleData) {
    return NextResponse.json({ error: 'Failed to generate level' }, { status: 500 })
  }

  return NextResponse.json({ puzzleData })
}
