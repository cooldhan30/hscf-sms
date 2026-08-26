import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { getInteractiveGameModule } from '@/lib/gameRoom/registry'
import { generateOrderGame } from '@/lib/gameRoom/modules/uyirEzhuthukkal/orderGame'
import { generateMemoryGame } from '@/lib/gameRoom/modules/uyirEzhuthukkal/memoryGame'

// POST /api/game-room/interactive/start -- student-only. Starts a solo
// interactive game (drag-order or memory-match) -- no join code, no
// waiting room, no other players, matching the confirmed "solo/practice
// only" scope for these two games. Unlike the quiz engine's /join +
// /state (two round trips before a student sees anything), this returns
// the session id AND the freshly-shuffled board data in one response --
// there's no "current question" concept to poll separately, so there's
// nothing to gain by splitting this into two calls.
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

  const gameType = typeof body.gameType === 'string' ? body.gameType : ''
  const gameModule = getInteractiveGameModule(gameType)
  if (!gameModule) {
    return NextResponse.json({ error: `Unknown game: "${gameType}"` }, { status: 400 })
  }

  // Board data is generated once here and handed to the client -- it is
  // NEVER re-derived or re-fetched afterward (unlike the quiz engine's
  // question_ids/question_order, which the server keeps re-reading on
  // every poll). The whole point of a solo, non-competitive game is that
  // the interaction can live entirely in client state until the single
  // terminal /complete call.
  const gameData = gameType === 'uyir-order' ? generateOrderGame() : generateMemoryGame()

  const { data: session, error: sessionError } = await supabase
    .from('sms_game_sessions')
    .insert([
      {
        host_teacher_id: null,
        host_student_id: student.id,
        is_solo_practice: true,
        game_kind: 'interactive',
        status: 'active',
        started_at: new Date().toISOString(),
        game_type: gameType,
        quiz_mode: 'full',
        question_count: gameModule.maxScore,
        question_time_limit_seconds: 30,
        question_ids: [],
      },
    ])
    .select()
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: sessionError?.message || 'Failed to start game' }, { status: 400 })
  }

  const nickname = `${student.first_name} ${student.last_name}`.trim()

  const { error: playerError } = await supabase.from('sms_game_players').insert([
    {
      session_id: session.id,
      student_id: student.id,
      nickname,
      question_order: [],
    },
  ])

  if (playerError) {
    return NextResponse.json({ error: playerError.message }, { status: 400 })
  }

  return NextResponse.json({ sessionId: session.id, gameData }, { status: 201 })
}
