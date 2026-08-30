import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { getLevelConfig, levelPositionWithinComplexity, getLevelsForComplexity } from '@/lib/gameRoom/modules/tamilWordFormation/levels'

const POINTS_PER_WORD = 10

// POST /api/game-room/word-formation/complete -- student-only. Body:
// { level, wordsCompleted }. hintsUsed is tracked and shown by the
// client's own completion screen but isn't persisted server-side (no
// column for it yet, and it isn't part of the leaderboard score).
// Called once when a level's 5 words are all correctly formed. Writes
// ONE sms_game_sessions +
// sms_game_players row (is_solo_practice: false, same as every other
// interactive game) so completed levels show up in history/leaderboard
// exactly like a completed board in any other game -- score is
// wordsCompleted * 10, matching the spec's "+10 per correct word".
// Also advances sms_word_formation_progress.highest_unlocked for this
// complexity by one position if this was the highest level reached so
// far, unlocking the next level in that tier.
export async function POST(request: Request) {
  const guard = await requireStudent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, student } = guard

  const body = await request.json().catch(() => null)
  const level = Number(body?.level)
  const wordsCompleted = Number(body?.wordsCompleted)

  const config = getLevelConfig(level)
  if (!config) {
    return NextResponse.json({ error: `Unknown level: ${level}` }, { status: 400 })
  }
  if (!Number.isInteger(wordsCompleted) || wordsCompleted < 0 || wordsCompleted > config.wordsPerLevel) {
    return NextResponse.json({ error: 'Invalid wordsCompleted' }, { status: 400 })
  }

  const position = levelPositionWithinComplexity(level)
  if (position === null) {
    return NextResponse.json({ error: `Unknown level: ${level}` }, { status: 400 })
  }

  const score = wordsCompleted * POINTS_PER_WORD
  const maxScore = config.wordsPerLevel * POINTS_PER_WORD
  const nickname = `${student.first_name} ${student.last_name}`.trim()

  const { data: session, error: sessionError } = await supabase
    .from('sms_game_sessions')
    .insert([
      {
        host_teacher_id: null,
        host_student_id: student.id,
        is_solo_practice: false,
        game_kind: 'interactive',
        status: 'ended',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        game_type: `word-formation-level-${level}`,
        quiz_mode: 'full',
        question_count: config.wordsPerLevel,
        question_time_limit_seconds: 30,
        question_ids: [],
      },
    ])
    .select()
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: sessionError?.message || 'Failed to record level completion' }, { status: 400 })
  }

  const { error: playerError } = await supabase.from('sms_game_players').insert([
    {
      session_id: session.id,
      student_id: student.id,
      nickname,
      question_order: [],
      score,
      correct_count: wordsCompleted,
      answered_count: config.wordsPerLevel,
      completed: true,
      completed_at: new Date().toISOString(),
    },
  ])

  if (playerError) {
    return NextResponse.json({ error: playerError.message }, { status: 400 })
  }

  // Unlock the next level in this complexity if this was a fully
  // solved level and it was the furthest the student has reached.
  let unlockedNext = false
  if (wordsCompleted === config.wordsPerLevel) {
    const { data: progress } = await supabase
      .from('sms_word_formation_progress')
      .select('highest_unlocked')
      .eq('student_id', student.id)
      .eq('complexity', config.complexity)
      .maybeSingle()

    const currentHighest = progress?.highest_unlocked ?? 1
    const totalLevelsInComplexity = getLevelsForComplexity(config.complexity).length
    const nextPosition = Math.min(position + 1, totalLevelsInComplexity)

    if (nextPosition > currentHighest) {
      await supabase
        .from('sms_word_formation_progress')
        .upsert(
          { student_id: student.id, complexity: config.complexity, highest_unlocked: nextPosition, updated_at: new Date().toISOString() },
          { onConflict: 'student_id,complexity' }
        )
      unlockedNext = nextPosition > position
    }
  }

  return NextResponse.json({ success: true, score, maxScore, unlockedNext })
}
