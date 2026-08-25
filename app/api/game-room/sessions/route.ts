import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString, requireEnum } from '@/lib/validation'
import { getGameModule } from '@/lib/gameRoom/registry'
import { selectSessionQuestions, InvalidQuizConfigError, type QuizMode } from '@/lib/gameRoom/selectQuestions'

const QUIZ_MODES = ['full', 'count', 'category'] as const
const TIME_LIMITS = [10, 15, 20, 30] as const
type TimeLimit = (typeof TIME_LIMITS)[number]

// POST /api/game-room/sessions -- teacher-only. Creates a new Game Room
// session: resolves the requested game module, runs randomization #1
// (selectSessionQuestions -- the FIXED question set every player in this
// session will receive), and persists the session in 'waiting' status.
// Each player's own shuffled order of this same set (randomization #2)
// happens separately, once per player, at join time.
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
  const gameType = requireString(body.gameType, 'Game', errors)
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

  const { data: session, error } = await supabase
    .from('sms_game_sessions')
    .insert([
      {
        host_teacher_id: teacher.id,
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ sessionId: session.id, joinCode: session.join_code }, { status: 201 })
}
