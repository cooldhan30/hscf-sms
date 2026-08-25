import { NextResponse } from 'next/server'
import { requireGamePlayer } from '@/lib/gameRoom/requirePlayer'
import { getGameModule } from '@/lib/gameRoom/registry'
import { calculatePoints } from '@/lib/gameRoom/scoring'

// POST /api/game-room/answer -- anonymous. Body:
// { playerToken, questionIndex, selectedAnswer } (selectedAnswer is null
// for a client-detected timeout). This is the only place scoring
// happens, and it happens ENTIRELY server-side: correctness, response
// time, and points are all computed here from server-held state, never
// trusting anything the client claims except which option it picked.
//
// Anti-cheat (spec section 19/39):
// - questionIndex must equal the player's current_index -- rejects
//   stale/replayed/skip-ahead submissions from a client that's out of
//   sync with server state.
// - response_time_ms is now() - current_question_started_at (a
//   server-set timestamp), never a client-supplied duration.
// - the sms_game_answers UNIQUE(player_id, question_index) constraint is
//   the hard backstop against double-answering the same question, on
//   top of the current_index check here.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const guard = await requireGamePlayer(body.playerToken)
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, player, session } = guard

  if (session.status !== 'active') {
    return NextResponse.json({ error: `Cannot answer -- game is "${session.status}"` }, { status: 409 })
  }
  if (player.completed) {
    return NextResponse.json({ error: 'You have already finished this quiz' }, { status: 409 })
  }

  const questionIndex = Number(body.questionIndex)
  if (!Number.isInteger(questionIndex) || questionIndex !== player.current_index) {
    return NextResponse.json(
      { error: 'This question is no longer current -- refresh your game state' },
      { status: 409 }
    )
  }

  const selectedAnswer = typeof body.selectedAnswer === 'string' ? body.selectedAnswer : null

  const gameModule = getGameModule(session.game_type)
  if (!gameModule) {
    return NextResponse.json({ error: 'Game module not found' }, { status: 500 })
  }
  const bankById = new Map(gameModule.getQuestionBank().map((q) => [q.id, q]))
  const questionId = player.question_order[questionIndex]
  const question = bankById.get(questionId)
  if (!question) {
    return NextResponse.json({ error: 'Question not found in bank' }, { status: 500 })
  }

  const responseTimeMs = Date.now() - new Date(player.current_question_started_at).getTime()
  const isCorrect = selectedAnswer !== null && selectedAnswer === question.correctAnswer
  const points = calculatePoints(isCorrect, responseTimeMs, session.question_time_limit_seconds)

  // The UNIQUE(player_id, question_index) constraint on sms_game_answers
  // turns a duplicate submission (e.g. a race between two tabs, or a
  // retried request) into a clean insert failure rather than double
  // counting -- checked here to return a clear error instead of a raw
  // Postgres constraint-violation message.
  const { error: insertError } = await supabase.from('sms_game_answers').insert([
    {
      player_id: player.id,
      question_id: questionId,
      question_index: questionIndex,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      points,
      response_time_ms: responseTimeMs,
    },
  ])

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'You already answered this question' }, { status: 409 })
    }
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  const newIndex = player.current_index + 1
  const isNowCompleted = newIndex >= player.question_order.length

  const { data: updatedPlayer, error: updateError } = await supabase
    .from('sms_game_players')
    .update({
      current_index: newIndex,
      current_question_started_at: new Date().toISOString(),
      score: player.score + points,
      correct_count: player.correct_count + (isCorrect ? 1 : 0),
      answered_count: player.answered_count + 1,
      completed: isNowCompleted,
      completed_at: isNowCompleted ? new Date().toISOString() : null,
    })
    .eq('id', player.id)
    .select()
    .single()

  if (updateError || !updatedPlayer) {
    return NextResponse.json({ error: updateError?.message || 'Failed to record answer' }, { status: 400 })
  }

  // Auto-finish (spec section 11): if every player in this session has
  // now completed the quiz, end it automatically -- the teacher's
  // manual "End Game" (sessions/[id]/end/route.ts) exists for the case
  // where a straggler never finishes/disconnects, not as the only path.
  if (isNowCompleted) {
    const { data: remainingPlayers } = await supabase
      .from('sms_game_players')
      .select('id')
      .eq('session_id', session.id)
      .eq('completed', false)

    if ((remainingPlayers ?? []).length === 0) {
      await supabase
        .from('sms_game_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', session.id)
        .eq('status', 'active')
    }
  }

  const { data: rankedPlayers } = await supabase
    .from('sms_game_players')
    .select('id, score')
    .eq('session_id', session.id)
    .order('score', { ascending: false })
  const rank = (rankedPlayers ?? []).findIndex((p) => p.id === player.id) + 1

  return NextResponse.json({
    isCorrect,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    points,
    newScore: updatedPlayer.score,
    rank,
    completed: isNowCompleted,
  })
}
