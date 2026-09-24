import { NextResponse } from 'next/server'
import { requireGameV2Student } from '@/lib/gameRoomV2/requireStudentAccess'
import { levelForXp } from '@/lib/gameRoomV2/progression/levels'
import { ACHIEVEMENTS, getAchievement } from '@/lib/gameRoomV2/progression/achievements'
import { dailyChallengeForDate } from '@/lib/gameRoomV2/progression/dailyChallenge'
import { getGameEngineV2 } from '@/lib/gameRoomV2/registry'

// GET /api/gameroom-v2/progression -- the one read endpoint for
// everything the shared progression system tracks: level/XP/coins,
// daily practice streak, per-engine mastery, question-set completion
// counts, earned achievements (each paired with its catalog
// definition so the client never needs a second lookup), and today's
// daily challenge with the student's current progress toward it.
// Read-only: every table this reads only ever gets WRITTEN by
// lib/gameRoomV2/rewards/rewardService.ts, never by this route or any
// client-side code.
export async function GET() {
  const guard = await requireGameV2Student()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, student } = guard

  const todayIso = new Date().toISOString().slice(0, 10)

  const [statsRes, masteryRes, achievementsRes, dailyRes] = await Promise.all([
    supabase
      .from('sms_gamev2_player_stats')
      .select('total_xp, total_coins, sessions_completed, current_daily_streak, best_daily_streak, correct_answers_total, last_active_date')
      .eq('student_id', student.id)
      .single(),
    supabase
      .from('sms_gamev2_engine_mastery')
      .select('engine_id, sessions_completed, best_score, best_accuracy_pct, xp_from_engine, last_played_at')
      .eq('student_id', student.id),
    supabase.from('sms_gamev2_player_achievements').select('achievement_id, earned_at').eq('student_id', student.id),
    supabase
      .from('sms_gamev2_daily_challenge_progress')
      .select('progress_count, completed_at')
      .eq('student_id', student.id)
      .eq('challenge_date', todayIso)
      .single(),
  ])

  const stats = statsRes.data ?? {
    total_xp: 0,
    total_coins: 0,
    sessions_completed: 0,
    current_daily_streak: 0,
    best_daily_streak: 0,
    correct_answers_total: 0,
    last_active_date: null,
  }

  const levelProgress = levelForXp(stats.total_xp)

  const mastery = (masteryRes.data ?? []).map((row) => {
    const engine = getGameEngineV2(row.engine_id)
    return {
      engineId: row.engine_id,
      engineName: engine?.name ?? row.engine_id,
      sessionsCompleted: row.sessions_completed,
      bestScore: row.best_score,
      bestAccuracyPct: row.best_accuracy_pct,
      lastPlayedAt: row.last_played_at,
    }
  })

  const earnedAchievements = (achievementsRes.data ?? [])
    .map((row) => {
      const def = getAchievement(row.achievement_id)
      if (!def) return null
      return {
        id: def.id,
        name: def.name,
        tamilName: def.tamilName,
        teacherDescription: def.teacherDescription,
        studentDescription: def.studentDescription,
        icon: def.icon,
        category: def.category,
        earnedAt: row.earned_at,
      }
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)

  const earnedIds = new Set(earnedAchievements.map((a) => a.id))
  const lockedAchievements = ACHIEVEMENTS.filter((a) => !earnedIds.has(a.id)).map((a) => ({
    id: a.id,
    name: a.name,
    tamilName: a.tamilName,
    teacherDescription: a.teacherDescription,
    studentDescription: a.studentDescription,
    icon: a.icon,
    category: a.category,
  }))

  const challenge = dailyChallengeForDate(todayIso)
  const dailyChallenge = {
    id: challenge.id,
    name: challenge.name,
    description: challenge.description,
    goalCount: challenge.goalCount,
    xpReward: challenge.xpReward,
    coinsReward: challenge.coinsReward,
    progressCount: dailyRes.data?.progress_count ?? 0,
    completed: Boolean(dailyRes.data?.completed_at),
  }

  return NextResponse.json({
    totalXp: stats.total_xp,
    totalCoins: stats.total_coins,
    sessionsCompleted: stats.sessions_completed,
    correctAnswersTotal: stats.correct_answers_total,
    level: levelProgress.level,
    xpIntoCurrentLevel: levelProgress.xpIntoCurrentLevel,
    xpNeededForNextLevel: levelProgress.xpNeededForNextLevel,
    currentDailyStreak: stats.current_daily_streak,
    bestDailyStreak: stats.best_daily_streak,
    mastery,
    earnedAchievements,
    lockedAchievements,
    dailyChallenge,
  })
}
