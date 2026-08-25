import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { requireEnum } from '@/lib/validation'
import { getGameModule } from '@/lib/gameRoom/registry'
import { selectSessionQuestions, InvalidQuizConfigError, type QuizMode } from '@/lib/gameRoom/selectQuestions'
import { shuffle } from '@/lib/gameRoom/shuffle'

const QUIZ_MODES = ['full', 'count', 'category'] as const
const TIME_LIMITS = [10, 15, 20, 30] as const
type TimeLimit = (typeof TIME_LIMITS)[number]

// POST /api/game-room/practice -- student-only. A "retake on your own":
// same quiz config a teacher picks (game/mode/category/count/timer), but
// the student is their own host -- no waiting room, no other players.
// Mirrors app/api/game-room/sessions/route.ts's question-selection logic
// exactly, but sets is_solo_practice/host_student_id instead of
// host_teacher_id, starts the session immediately (status: 'active',
// since there's no one else to wait for), and creates the student's own
// sms_game_players row in the same request so the client can go straight
// to the play screen. Solo practice sessions are tracked in the
// student's own history but deliberately do NOT count toward the
// cross-game leaderboard (see app/api/game-room/leaderboard-alltime) --
// otherwise a student could out-rank classmates just by replaying alone.
export async function POST(request: Request) {
  const guard = await requireStudent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, student } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const gameType = typeof body.gameType === 'string' ? body.gameType : ''
  if (!gameType) errors.push('Game is required')
  const quizMode = requireEnum(body.quizMode, QUIZ_MODES, 'Quiz mode', errors)
  const category = typeof body.category === 'string' && body.category ? body.category : undefined
  const count = typeof body.count === 'number' && body.count > 0 ? body.count : undefined

  let timeLimitSeconds: TimeLimit | undefined
  if (!TIME_LIMITS.includes(body.timeLimitSeconds)) {
    errors.push('Time limit must be one of: 10, 15, 20, 30')
  } else {
    timeLimitSeconds = body.timeLimitSeconds as TimeLimit
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const gameModule = getGameModule(gameType)
  if (!gameModule) {
    return NextResponse.json({ error: `Unknown game: "${gameType}"` }, { status: 400 })
  }

  if (quizMode === 'category' && !category) {
    return NextResponse.json({ error: 'Category is required for category mode' }, { status: 400 })
  }
  if (quizMode === 'count' && !count) {
    return NextResponse.json({ error: 'Question count is required for count mode' }, { status: 400 })
  }

  let questions
  try {
    questions = selectSessionQuestions(gameModule, { mode: quizMode as QuizMode, category, count })
  } catch (err) {
    if (err instanceof InvalidQuizConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const { data: session, error: sessionError } = await supabase
    .from('sms_game_sessions')
    .insert([
      {
        host_teacher_id: null,
        host_student_id: student.id,
        is_solo_practice: true,
        status: 'active',
        started_at: new Date().toISOString(),
        game_type: gameType,
        quiz_mode: quizMode,
        category_filter: category ?? null,
        question_count: questions.length,
        question_time_limit_seconds: timeLimitSeconds,
        question_ids: questions.map((q) => q.id),
      },
    ])
    .select()
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: sessionError?.message || 'Failed to start practice' }, { status: 400 })
  }

  const questionOrder = shuffle(session.question_ids)
  const nickname = `${student.first_name} ${student.last_name}`.trim()

  const { error: playerError } = await supabase.from('sms_game_players').insert([
    {
      session_id: session.id,
      student_id: student.id,
      nickname,
      question_order: questionOrder,
    },
  ])

  if (playerError) {
    return NextResponse.json({ error: playerError.message }, { status: 400 })
  }

  return NextResponse.json({ sessionId: session.id }, { status: 201 })
}
