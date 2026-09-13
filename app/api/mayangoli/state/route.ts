import { NextResponse } from 'next/server'
import { requireMayangoliPlayer } from '@/lib/gameRoom/modules/mayangoli/requireSession'
import { resolveMayangoliQuestion } from '@/lib/gameRoom/modules/mayangoli/sessionQuestions'

// POST /api/mayangoli/state -- student-only. Body: { sessionId }.
// Polled as a Realtime-change-triggered refetch (not a fixed interval --
// see the student client, which subscribes to sms_mayangoli_sessions
// changes and re-fetches state on every update) rather than a fixed
// 2s poll, since Realtime already tells the client the instant the room
// advances; this route resolves the actual question CONTENT (Realtime
// only carries the row change, not the generated question), this
// player's own answer status for the current question, and -- only
// once the room is in 'reveal' -- the correct answer + aggregate stats.
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

  const base = {
    sessionStatus: session.status,
    currentQuestionIndex: session.current_question_index,
    totalQuestions: session.question_ids.length,
    score: player.score,
    currentStreak: player.current_streak,
    bestStreak: player.best_streak,
  }

  if (session.status === 'waiting' || session.status === 'ended' || session.current_question_index < 0) {
    return NextResponse.json({ ...base, question: null, remainingSeconds: null, alreadyAnswered: false, reveal: null })
  }

  let resolved
  try {
    resolved = resolveMayangoliQuestion(session.id, session.question_ids, session.current_question_index)
  } catch {
    return NextResponse.json({ error: 'Question not found in word bank' }, { status: 500 })
  }
  const { question } = resolved

  const { data: myAnswer } = await supabase
    .from('sms_mayangoli_answers')
    .select('selected_answer, is_correct, points')
    .eq('player_id', player.id)
    .eq('question_index', session.current_question_index)
    .maybeSingle()

  const startedAt = session.current_question_started_at ? new Date(session.current_question_started_at).getTime() : Date.now()
  const elapsedMs = Date.now() - startedAt
  const remainingSeconds = Math.max(0, session.question_time_limit_seconds - Math.floor(elapsedMs / 1000))

  // Never expose the correct answer or aggregate stats to a student
  // while the question is still 'active' -- only once the room enters
  // 'reveal'. The question prompt/options themselves ARE safe to send
  // while active (that's the question being asked); the answer key is
  // the only thing withheld.
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
      percentCorrect:
        summary && summary.total_answers > 0 ? Math.round((100 * summary.correct_answers) / summary.total_answers) : 0,
    }
  }

  return NextResponse.json({
    ...base,
    remainingSeconds,
    alreadyAnswered: !!myAnswer,
    myAnswer: myAnswer ?? null,
    reveal,
    question: {
      questionType: question.questionType,
      prompt: question.prompt,
      options: question.options,
      supportingText: question.supportingText ?? null,
    },
  })
}
