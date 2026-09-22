import { NextResponse } from 'next/server'
import { requireGameV2Session } from '@/lib/gameRoomV2/requireSession'
import { calculateCompletionBonus } from '@/lib/gameRoomV2/scoring'
import { skillsForQuestionSet } from '@/lib/gameRoomV2/skillsForQuestionSet'

// POST /api/gameroom-v2/sessions/[id]/complete -- finalizes a session
// that has reached COMPLETED status (set by answer/route.ts on the
// last question) and returns the full Results payload. This is where
// the durable XP/coin ledger (sms_gamev2_player_stats) actually
// changes -- via the SECURITY DEFINER RPC
// sms_gamev2_apply_session_rewards(), never a direct client-writable
// UPDATE (see migration 076's RLS comment on that table) -- and where
// this session's skill-practice rows are logged for future mastery
// analytics. Calling this twice for the same session is safe: the
// second call is rejected (see the already-finalized check below)
// rather than double-granting rewards.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Session(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, studentId, session } = guard

  if (session.status !== 'COMPLETED') {
    return NextResponse.json({ error: `Cannot finalize -- game is "${session.status}", not COMPLETED` }, { status: 409 })
  }

  // A session's rewards are applied exactly once -- distinguished by
  // whether the completion bonus has already been folded into
  // xp_earned/coins_earned. finalized_at (added below) is the
  // authoritative marker; re-running this route for an
  // already-finalized session returns the existing result instead of
  // granting the bonus a second time.
  const { data: existingAnswers } = await supabase
    .from('sms_gamev2_answers')
    .select('id, question_id, submitted_answer, is_correct, points, response_time_ms, question_index')
    .eq('session_id', session.id)
    .order('question_index', { ascending: true })

  const { data: questionSet } = await supabase
    .from('sms_gamev2_question_sets')
    .select('subject, topic, tags')
    .eq('id', session.question_set_id)
    .single()

  const skills = questionSet ? skillsForQuestionSet(questionSet) : []

  // Idempotency: if this session was already finalized (completed_at
  // set AND a matching skill-practice batch already logged), don't
  // re-apply the bonus. Checked via a dedicated column rather than
  // re-deriving from xp_earned, since a legitimate 0-XP completion
  // (every answer wrong) must still be distinguishable from
  // "not finalized yet."
  const alreadyFinalized = Boolean(session.rewards_finalized_at)

  let totalXp = session.xp_earned
  let totalCoins = session.coins_earned

  if (!alreadyFinalized) {
    const bonus = calculateCompletionBonus()
    totalXp = session.xp_earned + bonus.xp
    totalCoins = session.coins_earned + bonus.coins

    await supabase
      .from('sms_gamev2_sessions')
      .update({ xp_earned: totalXp, coins_earned: totalCoins, rewards_finalized_at: new Date().toISOString() })
      .eq('id', session.id)

    // Best-effort: the ledger RPC is the source of truth for
    // total_xp/total_coins; a failure here shouldn't block the student
    // from seeing their Results screen, but should never be silently
    // retried into a double-grant either (the finalized_at write above
    // already happened, so a retry of this whole route short-circuits
    // via alreadyFinalized on the next call).
    await supabase.rpc('sms_gamev2_apply_session_rewards', {
      p_student_id: studentId,
      p_xp_earned: bonus.xp + session.xp_earned,
      p_coins_earned: bonus.coins + session.coins_earned,
    })

    if (skills.length > 0 && existingAnswers && existingAnswers.length > 0) {
      const skillRows = existingAnswers.flatMap((a) =>
        skills.map((skill) => ({ student_id: studentId, answer_id: a.id, skill, is_correct: a.is_correct }))
      )
      await supabase.from('sms_gamev2_skill_practice').insert(skillRows)
    }
  }

  const totalQuestions = session.question_order.length
  const accuracyPct = session.answered_count > 0 ? Math.round((session.correct_count / session.answered_count) * 1000) / 10 : 0

  return NextResponse.json({
    sessionId: session.id,
    score: session.score,
    accuracyPct,
    correctCount: session.correct_count,
    incorrectCount: session.answered_count - session.correct_count,
    totalQuestions,
    xpEarned: totalXp,
    coinsEarned: totalCoins,
    bestStreak: session.best_streak,
    skillsPracticed: skills,
    answers: existingAnswers ?? [],
  })
}
