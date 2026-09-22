import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import { calculateCompletionBonus } from '@/lib/gameRoomV2/scoring'
import { skillsForQuestionSet } from '@/lib/gameRoomV2/skillsForQuestionSet'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'
import { computeEngineMilestone } from '@/lib/gameRoomV2/progression/engineMilestone'
import { levelForXp } from '@/lib/gameRoomV2/progression/levels'
import { applyDailyActivity } from '@/lib/gameRoomV2/progression/streaks'
import { evaluateAchievements, type AchievementContext } from '@/lib/gameRoomV2/progression/achievementRules'
import { dailyChallengeForDate, applyDailyChallengeProgress } from '@/lib/gameRoomV2/progression/dailyChallenge'
import type { GameV2SessionRow } from '@/lib/gameRoomV2/requireSession'

// THE centralized reward service, per the explicit request: "Games
// should emit results. The reward system determines XP/coins. Do not
// let individual game clients arbitrarily award currency." This module
// is the ONLY code path allowed to call the SECURITY DEFINER RPCs that
// mutate sms_gamev2_player_stats/engine_mastery/question_set_completions/
// player_achievements/daily_challenge_progress. It is called from
// exactly one place -- sessions/[id]/complete/route.ts -- which already
// guards against double-finalization via rewards_finalized_at; this
// service does not re-check that guard itself, since the route's
// existing check is what makes calling this function safe to call
// exactly once per session.
//
// No game engine (Tower Defense, Boss Battle, Racing, Treasure Quest,
// Word Ninja, Classic Quiz) ever calls anything in this file, imports
// the SECURITY DEFINER RPC names, or computes its own XP/coins for the
// durable ledger -- confirmed by grep across every lib/gameRoomV2/<engine>/
// directory (none imports `supabase`). An engine's own in-game
// "currency" (Tower Defense coins, Boss Battle charge, Treasure Quest
// keys, Racing boosts) is unrelated, client-local, ephemeral gameplay
// state that resets every playthrough -- this service is only ever
// invoked once, after a session's real, server-graded answers are
// already fully persisted.
export interface SessionFinalizationInput {
  supabase: ReturnType<typeof createClient>
  studentId: string
  session: GameV2SessionRow
  // Server date string ('YYYY-MM-DD'), computed by the caller so this
  // service stays pure-ish and testable -- see route.ts's use of
  // `new Date().toISOString().slice(0, 10)`.
  todayIso: string
}

export interface SessionFinalizationResult {
  xpEarned: number
  coinsEarned: number
  totalXp: number
  totalCoins: number
  level: number
  newlyEarnedAchievementIds: string[]
  dailyChallengeCompleted: boolean
  currentDailyStreak: number
}

// Finalizes a COMPLETED session's rewards: applies the completion
// bonus to the session row, updates the durable XP/coin ledger, then
// evaluates and persists every other progression concern (engine
// mastery, question-set completion, daily practice streak,
// achievements, daily challenge progress) in that order. Every input
// to every calculation here is either already persisted on the session
// row (answered_count, correct_count, lives, xp_earned, coins_earned)
// or derived from it -- nothing here trusts a value the client passed
// in this request.
export async function finalizeSessionRewards(input: SessionFinalizationInput): Promise<SessionFinalizationResult> {
  const { supabase, studentId, session, todayIso } = input

  const bonus = calculateCompletionBonus()
  const totalSessionXp = session.xp_earned + bonus.xp
  const totalSessionCoins = session.coins_earned + bonus.coins

  await supabase
    .from('sms_gamev2_sessions')
    .update({ xp_earned: totalSessionXp, coins_earned: totalSessionCoins, rewards_finalized_at: new Date().toISOString() })
    .eq('id', session.id)

  const { data: ledger } = await supabase.rpc('sms_gamev2_apply_session_rewards', {
    p_student_id: studentId,
    p_xp_earned: totalSessionXp,
    p_coins_earned: totalSessionCoins,
  })
  const ledgerRow = Array.isArray(ledger) ? ledger[0] : ledger

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

  if (questionSet) {
    const skills = skillsForQuestionSet(questionSet)
    if (skills.length > 0 && existingAnswers && existingAnswers.length > 0) {
      const skillRows = existingAnswers.flatMap((a) => skills.map((skill) => ({ student_id: studentId, answer_id: a.id, skill, is_correct: a.is_correct })))
      await supabase.from('sms_gamev2_skill_practice').insert(skillRows)
    }
  }

  const totalQuestions = session.question_order.length
  const accuracyPct = session.answered_count > 0 ? Math.round((session.correct_count / session.answered_count) * 1000) / 10 : 0

  // Daily practice streak -- read the pre-update row so
  // applyDailyActivity sees the state as it was BEFORE this session,
  // exactly once per session (this service is only ever invoked once
  // per session, per the caller's rewards_finalized_at guard).
  const { data: statsBefore } = await supabase
    .from('sms_gamev2_player_stats')
    .select('last_active_date, current_daily_streak, best_daily_streak, correct_answers_total')
    .eq('student_id', studentId)
    .single()

  const streakResult = applyDailyActivity(todayIso, {
    lastActiveDate: statsBefore?.last_active_date ?? null,
    currentDailyStreak: statsBefore?.current_daily_streak ?? 0,
    bestDailyStreak: statsBefore?.best_daily_streak ?? 0,
  })

  const { data: existingAchievements } = await supabase
    .from('sms_gamev2_player_achievements')
    .select('achievement_id')
    .eq('student_id', studentId)

  const { data: enginesPlayedRows } = await supabase.from('sms_gamev2_engine_mastery').select('engine_id').eq('student_id', studentId)
  const enginesPlayed = Array.from(new Set([...(enginesPlayedRows ?? []).map((r) => r.engine_id), session.engine_id]))

  const engineMilestoneReached = computeEngineMilestone({
    answeredCount: session.answered_count,
    totalQuestions,
    correctCount: session.correct_count,
    lives: session.lives,
    maxLives: session.max_lives,
  })

  const { data: qsCompletionRow } = await supabase
    .from('sms_gamev2_question_set_completions')
    .select('completion_count')
    .eq('student_id', studentId)
    .eq('question_set_id', session.question_set_id)
    .single()

  const achievementContext: AchievementContext = {
    sessionsCompletedTotal: (ledgerRow?.sessions_completed as number | undefined) ?? 0,
    correctAnswersTotal: (statsBefore?.correct_answers_total ?? 0) + session.correct_count,
    currentDailyStreak: streakResult.currentDailyStreak,
    sessionAccuracyPct: accuracyPct,
    sessionAnsweredCount: session.answered_count,
    sessionCorrectCount: session.correct_count,
    engineId: session.engine_id,
    enginesPlayed,
    totalActiveEngineCount: GAME_ENGINES_V2.filter((e) => e.status === 'ACTIVE' || e.status === 'BETA').length,
    engineMilestoneReached,
    questionSetCompletionCount: (qsCompletionRow?.completion_count ?? 0) + 1,
    alreadyEarnedIds: (existingAchievements ?? []).map((a) => a.achievement_id),
  }

  const newlyEarned = evaluateAchievements(achievementContext)

  await supabase.rpc('sms_gamev2_apply_progression', {
    p_student_id: studentId,
    p_correct_answers_this_session: session.correct_count,
    p_current_daily_streak: streakResult.currentDailyStreak,
    p_best_daily_streak: streakResult.bestDailyStreak,
    p_last_active_date: streakResult.lastActiveDate,
    p_engine_id: session.engine_id,
    p_session_score: session.score,
    p_session_accuracy_pct: accuracyPct,
    p_question_set_id: session.question_set_id,
    p_achievement_ids: newlyEarned.map((a) => a.achievementId),
  })

  const { data: dailyProgressRow } = await supabase
    .from('sms_gamev2_daily_challenge_progress')
    .select('progress_count, completed_at')
    .eq('student_id', studentId)
    .eq('challenge_date', todayIso)
    .single()

  const challenge = dailyChallengeForDate(todayIso)
  const dailyProgress = applyDailyChallengeProgress(challenge, dailyProgressRow?.completed_at ? challenge.goalCount : (dailyProgressRow?.progress_count ?? 0), {
    engineId: session.engine_id,
    correctCount: session.correct_count,
  })

  await supabase.rpc('sms_gamev2_apply_daily_challenge_progress', {
    p_student_id: studentId,
    p_challenge_date: todayIso,
    p_challenge_id: challenge.id,
    p_new_progress_count: dailyProgress.progressCount,
    p_goal_count: challenge.goalCount,
    p_xp_reward: challenge.xpReward,
    p_coins_reward: challenge.coinsReward,
  })

  const { data: statsAfter } = await supabase
    .from('sms_gamev2_player_stats')
    .select('total_xp, total_coins')
    .eq('student_id', studentId)
    .single()

  const totalXp = statsAfter?.total_xp ?? ledgerRow?.total_xp ?? totalSessionXp
  const totalCoins = statsAfter?.total_coins ?? ledgerRow?.total_coins ?? totalSessionCoins

  return {
    xpEarned: totalSessionXp,
    coinsEarned: totalSessionCoins,
    // Read after every RPC above, including the daily-challenge one --
    // so totalXp/totalCoins already include a daily challenge bonus
    // completed by this very session. The Results screen still surfaces
    // dailyChallengeCompleted as its own signal so the UI can call that
    // bonus out explicitly rather than leaving it silently folded into
    // one number.
    totalXp,
    totalCoins,
    level: levelForXp(totalXp).level,
    newlyEarnedAchievementIds: newlyEarned.map((a) => a.achievementId),
    dailyChallengeCompleted: dailyProgress.completed && !dailyProgressRow?.completed_at,
    currentDailyStreak: streakResult.currentDailyStreak,
  }
}
