import { NextResponse } from 'next/server'
import { requireMayangoliHost } from '@/lib/gameRoom/modules/mayangoli/requireSession'
import { resolveMayangoliQuestion } from '@/lib/gameRoom/modules/mayangoli/sessionQuestions'

// POST /api/mayangoli/host-state -- teacher-only. Body: { sessionId }.
// The projector/host-dashboard view: current question (WITH the
// correct answer once 'reveal', same withholding rule as the student
// state route), live leaderboard, and per-question summary stats.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const guard = await requireMayangoliHost(body.sessionId)
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, session } = guard

  const { data: leaderboard } = await supabase.rpc('sms_mayangoli_leaderboard', { p_session_id: session.id })

  const base = {
    status: session.status,
    joinCode: session.join_code,
    currentQuestionIndex: session.current_question_index,
    totalQuestions: session.question_ids.length,
    leaderboard: leaderboard ?? [],
  }

  if (session.status === 'waiting' || session.status === 'ended' || session.current_question_index < 0) {
    return NextResponse.json({ ...base, question: null, reveal: null })
  }

  let resolved
  try {
    resolved = resolveMayangoliQuestion(session.id, session.question_ids, session.current_question_index)
  } catch {
    return NextResponse.json({ error: 'Question not found in word bank' }, { status: 500 })
  }
  const { question } = resolved

  let reveal = null
  if (session.status === 'reveal') {
    const { data: summary } = await supabase
      .rpc('sms_mayangoli_question_summary', {
        p_session_id: session.id,
        p_question_index: session.current_question_index,
      })
      .maybeSingle<{ total_answers: number; correct_answers: number; fastest_response_ms: number | null }>()

    reveal = {
      correctAnswer: question.correctAnswer,
      totalAnswers: summary?.total_answers ?? 0,
      correctAnswers: summary?.correct_answers ?? 0,
      fastestResponseMs: summary?.fastest_response_ms ?? null,
      percentCorrect:
        summary && summary.total_answers > 0 ? Math.round((100 * summary.correct_answers) / summary.total_answers) : 0,
    }
  }

  return NextResponse.json({
    ...base,
    question: {
      questionType: question.questionType,
      prompt: question.prompt,
      options: question.options,
      supportingText: question.supportingText ?? null,
    },
    reveal,
  })
}
