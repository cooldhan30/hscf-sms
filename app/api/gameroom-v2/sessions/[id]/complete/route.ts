import { NextResponse } from 'next/server'
import { requireGameV2Session } from '@/lib/gameRoomV2/requireSession'
import { skillsForQuestionSet } from '@/lib/gameRoomV2/skillsForQuestionSet'
import { finalizeSessionRewards } from '@/lib/gameRoomV2/rewards/rewardService'
import { levelForXp } from '@/lib/gameRoomV2/progression/levels'

// POST /api/gameroom-v2/sessions/[id]/complete -- finalizes a session
// that has reached COMPLETED status (set by answer/route.ts on the
// last question) and returns the full Results payload. All of the
// actual reward computation (XP/coin ledger, engine mastery, streaks,
// achievements, daily challenge) happens in ONE place --
// lib/gameRoomV2/rewards/rewardService.ts's finalizeSessionRewards(),
// the centralized "reward service" per the platform's explicit
// requirement that individual game clients never arbitrarily award
// currency. This route's own job is just: authenticate the caller,
// enforce the COMPLETED-status precondition, and guard against calling
// the reward service more than once for the same session.
//
// Calling this route twice for the same session -- sequentially OR
// concurrently -- is safe: finalization is claimed with ONE atomic
// compare-and-set (`rewards_finalized_at IS NULL` -> now) before any
// reward is granted, so exactly one request can ever win the claim and
// call finalizeSessionRewards. (Previously the route read
// rewards_finalized_at, then granted, then wrote it -- two parallel
// requests could both see NULL and both grant.) Every other caller
// returns the already-persisted results. If a request dies after
// winning the claim but before granting, the student is under-rewarded
// for that one session rather than ever double-rewarded -- the safe
// direction for a currency ledger.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Session(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, admin, studentId } = guard
  let session = guard.session

  if (session.status !== 'COMPLETED') {
    return NextResponse.json({ error: `Cannot finalize -- game is "${session.status}", not COMPLETED` }, { status: 409 })
  }

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

  // Idempotency: rewards_finalized_at is the authoritative marker,
  // checked via a dedicated column rather than re-deriving from
  // xp_earned, since a legitimate 0-XP completion (every answer wrong)
  // must still be distinguishable from "not finalized yet."
  let wonClaim = false
  if (!session.rewards_finalized_at) {
    const { data: claimed } = await admin
      .from('sms_gamev2_sessions')
      .update({ rewards_finalized_at: new Date().toISOString() })
      .eq('id', session.id)
      .eq('student_id', studentId)
      .eq('status', 'COMPLETED')
      .is('rewards_finalized_at', null)
      .select('id')
      .maybeSingle()
    wonClaim = Boolean(claimed)
  }
  const alreadyFinalized = !wonClaim

  if (alreadyFinalized) {
    // Another request finalized it (possibly a moment ago, in parallel)
    // -- re-read so the response reflects the bonus that request applied.
    const { data: fresh } = await supabase.from('sms_gamev2_sessions').select('*').eq('id', session.id).single()
    if (fresh) session = fresh
  }

  let xpEarned = session.xp_earned
  let coinsEarned = session.coins_earned
  let totalXp = 0
  let totalCoins = 0
  let level = 1
  let newlyEarnedAchievementIds: string[] = []
  let dailyChallengeCompleted = false
  let currentDailyStreak = 0

  if (!alreadyFinalized) {
    const result = await finalizeSessionRewards({
      supabase,
      admin,
      studentId,
      session,
      todayIso: new Date().toISOString().slice(0, 10),
    })
    xpEarned = result.xpEarned
    coinsEarned = result.coinsEarned
    totalXp = result.totalXp
    totalCoins = result.totalCoins
    level = result.level
    newlyEarnedAchievementIds = result.newlyEarnedAchievementIds
    dailyChallengeCompleted = result.dailyChallengeCompleted
    currentDailyStreak = result.currentDailyStreak
  } else {
    const { data: stats } = await supabase
      .from('sms_gamev2_player_stats')
      .select('total_xp, total_coins, current_daily_streak')
      .eq('student_id', studentId)
      .single()
    totalXp = stats?.total_xp ?? xpEarned
    totalCoins = stats?.total_coins ?? coinsEarned
    level = levelForXp(totalXp).level
    currentDailyStreak = stats?.current_daily_streak ?? 0
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
    xpEarned,
    coinsEarned,
    bestStreak: session.best_streak,
    skillsPracticed: skills,
    answers: existingAnswers ?? [],
    // Progression system fields -- see lib/gameRoomV2/progression/*.
    // newlyEarnedAchievementIds is empty on an already-finalized
    // re-fetch (achievements are granted exactly once, at the moment
    // they're first earned, never re-reported on a later poll of the
    // same session).
    totalXp,
    totalCoins,
    level,
    newlyEarnedAchievementIds,
    dailyChallengeCompleted,
    currentDailyStreak,
  })
}
