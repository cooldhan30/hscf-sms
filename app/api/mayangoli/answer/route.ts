import { NextResponse } from 'next/server'
import { requireMayangoliPlayer } from '@/lib/gameRoom/modules/mayangoli/requireSession'
import { resolveMayangoliQuestion } from '@/lib/gameRoom/modules/mayangoli/sessionQuestions'
import { calculateMayangoliPoints } from '@/lib/gameRoom/modules/mayangoli/scoring'

// POST /api/mayangoli/answer -- student-only. Body: { sessionId,
// questionIndex, selectedAnswer } (selectedAnswer null on a
// client-detected timeout). Server-authoritative scoring, same
// contract as the existing engine's answer route: correctness,
// response time, and points are computed here from server-held state
// only, never trusting a client-supplied point value or duration.
//
// Anti-cheat:
// - questionIndex must equal the ROOM's current_question_index (not a
//   per-player index, since Mayangoli is synchronized) -- rejects
//   answers submitted against a stale/already-advanced question.
// - response_time_ms is now() - session.current_question_started_at (a
//   server-set, room-wide timestamp), never client-supplied.
// - sms_mayangoli_answers' UNIQUE(player_id, question_index) is the
//   hard backstop against double-answering/replay.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const guard = await requireMayangoliPlayer(body.sessionId)
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, player, session } = guard

  if (session.status !== 'active') {
    return NextResponse.json({ error: `Cannot answer -- game is "${session.status}"` }, { status: 409 })
  }

  const questionIndex = Number(body.questionIndex)
  if (!Number.isInteger(questionIndex) || questionIndex !== session.current_question_index) {
    return NextResponse.json(
      { error: 'This question is no longer current -- refresh your game state' },
      { status: 409 }
    )
  }

  const selectedAnswer = typeof body.selectedAnswer === 'string' ? body.selectedAnswer : null

  let resolved
  try {
    resolved = resolveMayangoliQuestion(session.id, session.question_ids, questionIndex)
  } catch {
    return NextResponse.json({ error: 'Question not found in word bank' }, { status: 500 })
  }
  const { question, questionType } = resolved

  const startedAt = session.current_question_started_at
    ? new Date(session.current_question_started_at).getTime()
    : Date.now()
  const responseTimeMs = Math.max(0, Date.now() - startedAt)
  const isCorrect = selectedAnswer !== null && selectedAnswer === question.correctAnswer
  const { points, newStreak } = calculateMayangoliPoints(
    isCorrect,
    responseTimeMs,
    session.question_time_limit_seconds,
    player.current_streak
  )

  const { error: insertError } = await supabase.from('sms_mayangoli_answers').insert([
    {
      player_id: player.id,
      session_id: session.id,
      question_index: questionIndex,
      word_id: question.wordId,
      question_type: questionType,
      target_letter: question.targetLetter,
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

  const { data: updatedPlayer, error: updateError } = await supabase
    .from('sms_mayangoli_players')
    .update({
      score: player.score + points,
      correct_count: player.correct_count + (isCorrect ? 1 : 0),
      answered_count: player.answered_count + 1,
      current_streak: newStreak,
      best_streak: Math.max(player.best_streak, newStreak),
    })
    .eq('id', player.id)
    .select()
    .single()

  if (updateError || !updatedPlayer) {
    return NextResponse.json({ error: updateError?.message || 'Failed to record answer' }, { status: 400 })
  }

  return NextResponse.json({
    isCorrect,
    correctAnswer: question.correctAnswer,
    points,
    newScore: updatedPlayer.score,
    newStreak,
  })
}
