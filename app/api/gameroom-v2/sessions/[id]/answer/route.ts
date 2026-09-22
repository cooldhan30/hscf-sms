import { NextResponse } from 'next/server'
import { requireGameV2Session } from '@/lib/gameRoomV2/requireSession'
import { gradeAnswer } from '@/lib/gameRoomV2/gradeAnswer'
import { calculatePoints, calculateRewardsForAnswer } from '@/lib/gameRoomV2/scoring'
import { effectiveDimension, effectiveConceptTags, extractConfusionPair, confusionPairKey } from '@/lib/gameRoomV2/analytics'

// POST /api/gameroom-v2/sessions/[id]/answer -- the ONLY place scoring
// happens, entirely server-side. This is the "receive correct/
// incorrect/answer/response time/points" half of the SHOW QUESTION
// contract: the client submits { questionIndex, answer }, and every
// judgment about it -- whether it was right, how many points it earned,
// how much XP/coins it's worth -- is computed here from server-held
// state. Nothing the client claims (a correctness flag, a point value,
// a response time) is ever trusted.
//
// Anti-cheat, mirroring legacy GameRoom's proven answer/route.ts
// posture (reimplemented, not imported -- see requireSession.ts):
// - questionIndex must equal the session's current_index -- rejects a
//   stale/replayed/skip-ahead submission from a client out of sync
//   with server state.
// - response_time_ms is NOW() - current_question_started_at (a
//   server-set timestamp), never a client-supplied duration.
// - sms_gamev2_answers' UNIQUE(session_id, question_index) is the hard
//   backstop against double-answering, on top of the current_index
//   check here.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Session(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, studentId, session } = guard

  if (session.status !== 'ACTIVE') {
    return NextResponse.json({ error: `Cannot answer -- game is "${session.status}"` }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const questionIndex = Number(body.questionIndex)
  if (!Number.isInteger(questionIndex) || questionIndex !== session.current_index) {
    return NextResponse.json({ error: 'This question is no longer current -- refresh your game state' }, { status: 409 })
  }

  const questionId = session.question_order[questionIndex]
  if (!questionId) {
    return NextResponse.json({ error: 'No question at this index' }, { status: 409 })
  }

  const { data: question } = await supabase
    .from('sms_gamev2_questions')
    .select('id, question_type, payload, points, explanation, dimension, concept_tags')
    .eq('id', questionId)
    .single()

  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 500 })
  }

  // submittedAnswer may legitimately be null/undefined (a client-
  // detected timeout submits no answer at all) -- gradeAnswer() always
  // returns false for that, same as legacy GameRoom's null-on-timeout
  // handling.
  const submittedAnswer = 'answer' in body ? body.answer : null

  const responseTimeMs = session.current_question_started_at
    ? Date.now() - new Date(session.current_question_started_at).getTime()
    : session.question_time_limit_seconds * 1000

  const isCorrect = gradeAnswer(question.question_type, question.payload, submittedAnswer)
  const points = calculatePoints(isCorrect, responseTimeMs, session.question_time_limit_seconds)
  const { xp, coins } = calculateRewardsForAnswer(isCorrect, session.current_streak)

  // UNIQUE(session_id, question_index) turns a duplicate submission
  // (a race between two tabs, a retried request) into a clean insert
  // failure rather than double counting.
  const { data: insertedAnswer, error: insertError } = await supabase
    .from('sms_gamev2_answers')
    .insert([
      {
        session_id: session.id,
        question_id: questionId,
        question_index: questionIndex,
        submitted_answer: submittedAnswer,
        is_correct: isCorrect,
        points,
        response_time_ms: responseTimeMs,
      },
    ])
    .select('id')
    .single()

  if (insertError || !insertedAnswer) {
    if (insertError?.code === '23505') {
      return NextResponse.json({ error: 'You already answered this question' }, { status: 409 })
    }
    return NextResponse.json({ error: insertError?.message || 'Failed to record answer' }, { status: 400 })
  }

  // Learning analytics event -- tracks EDUCATIONAL performance
  // independently from game performance (score/XP/coins, handled
  // above/elsewhere). Written here, per-answer, rather than deferred to
  // session completion, since every input it needs (the question's own
  // dimension/concept_tags, the parent set's tags for the concept
  // fallback, and the already-graded correctness) is already in hand at
  // this exact moment. Best-effort: a failure here never blocks the
  // student's actual answer from being recorded or scored -- learning
  // analytics is a read model for teachers, not gameplay-critical path.
  const { data: questionSetForAnalytics } = await supabase
    .from('sms_gamev2_question_sets')
    .select('tags')
    .eq('id', session.question_set_id)
    .single()

  const dimension = effectiveDimension(question)
  const conceptTags = effectiveConceptTags(
    { conceptTags: question.concept_tags ?? [] },
    { tags: questionSetForAnalytics?.tags ?? [] }
  )
  const confusionPair = extractConfusionPair(question.question_type, question.payload as Record<string, unknown>, submittedAnswer, isCorrect)

  await supabase.from('sms_gamev2_learning_events').insert([
    {
      student_id: studentId,
      answer_id: insertedAnswer.id,
      question_set_id: session.question_set_id,
      engine_id: session.engine_id,
      question_type: question.question_type,
      dimension,
      concept_tags: conceptTags,
      is_correct: isCorrect,
      response_time_ms: responseTimeMs,
      confusion_pair_key: confusionPair ? confusionPairKey(confusionPair.correctValue, confusionPair.submittedValue) : null,
    },
  ])

  const newIndex = session.current_index + 1
  const isNowCompleted = newIndex >= session.question_order.length
  const newStreak = isCorrect ? session.current_streak + 1 : 0
  const newBestStreak = Math.max(session.best_streak, newStreak)
  // Lives are framework infrastructure (per the request's explicit
  // "Lives" system) -- decremented on any wrong answer here so the
  // shared session state always reflects it; a specific engine decides
  // whether losing all lives means anything (e.g. an early game-over)
  // by checking `lives` itself once it exists -- this route never ends
  // a session early on lives running out, since that's an
  // engine-specific rule, not a framework-wide one.
  const newLives = isCorrect ? session.lives : Math.max(0, session.lives - 1)

  const { data: updatedSession, error: updateError } = await supabase
    .from('sms_gamev2_sessions')
    .update({
      current_index: newIndex,
      current_question_started_at: isNowCompleted ? session.current_question_started_at : new Date().toISOString(),
      score: session.score + points,
      correct_count: session.correct_count + (isCorrect ? 1 : 0),
      answered_count: session.answered_count + 1,
      current_streak: newStreak,
      best_streak: newBestStreak,
      lives: newLives,
      xp_earned: session.xp_earned + xp,
      coins_earned: session.coins_earned + coins,
      status: isNowCompleted ? 'COMPLETED' : 'ACTIVE',
      completed_at: isNowCompleted ? new Date().toISOString() : null,
    })
    .eq('id', session.id)
    .select()
    .single()

  if (updateError || !updatedSession) {
    return NextResponse.json({ error: updateError?.message || 'Failed to record answer' }, { status: 400 })
  }

  // Reaching the last question marks the session COMPLETED here, but
  // deliberately does NOT apply the XP/coin ledger or skill-practice
  // log in this same request -- that's sessions/[id]/complete/route.ts's
  // job, called explicitly by the client once it sees `completed: true`
  // below. Keeping "the last answer was recorded" and "the session's
  // rewards were finalized" as two separate steps means a client that
  // never calls /complete (a crashed tab, a lost network connection
  // right after the last answer) leaves the session COMPLETED but
  // un-finalized rather than silently granting rewards from a request
  // that might not have actually reached the student -- see
  // complete/route.ts for why that split matters for lives-based
  // early-completion too, not just the last-question case.
  return NextResponse.json({
    isCorrect,
    points,
    xpEarned: xp,
    coinsEarned: coins,
    responseTimeMs,
    explanation: question.explanation,
    newScore: updatedSession.score,
    currentStreak: updatedSession.current_streak,
    lives: updatedSession.lives,
    completed: isNowCompleted,
  })
}
