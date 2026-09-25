import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import { BUILTIN_SET_IDS } from './catalog'
import {
  computeTopicProgress,
  computeBoardProgress,
  recommend,
  recentBuiltinActivity,
  type CompletionRow,
  type SessionRow,
  type TopicProgress,
  type BoardProgress,
  type Recommendation,
  type RecentActivity,
} from './progress'
import { LEARNING_BOARDS } from './catalog'

// Everything a student's GameRoom pages show about their own learning,
// read through the student's OWN RLS-scoped client ("student read own"
// policies on completions/sessions/stats/achievements) -- never the
// service-role client.

export interface InProgressSession {
  id: string
  questionSetId: string
  engineId: string
  answered: number
  total: number
  updatedAt: string
}

export interface StudentLearning {
  stats: { xp: number; coins: number; dailyStreak: number; longestStreak: number; correctAnswers: number; gamesCompleted: number }
  achievementIds: { id: string; earnedAt: string }[]
  topicProgress: Record<string, TopicProgress>
  boardProgress: BoardProgress[]
  recommendations: Recommendation[]
  recentActivity: RecentActivity[]
  inProgress: InProgressSession[]
  topicsPracticed: number
  topicsMastered: number
  overallAccuracy: number | null
}

export async function loadStudentLearning(supabase: ReturnType<typeof createClient>, studentId: string | null): Promise<StudentLearning> {
  if (!studentId) {
    const progress = computeTopicProgress([])
    return {
      stats: { xp: 0, coins: 0, dailyStreak: 0, longestStreak: 0, correctAnswers: 0, gamesCompleted: 0 },
      achievementIds: [],
      topicProgress: Object.fromEntries(progress),
      boardProgress: LEARNING_BOARDS.map((b) => computeBoardProgress(b, progress)),
      recommendations: recommend(progress, []),
      recentActivity: [],
      inProgress: [],
      topicsPracticed: 0,
      topicsMastered: 0,
      overallAccuracy: null,
    }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [{ data: stats }, { data: achievements }, { data: completions }, { data: sessions }, { data: open }, { data: liveLinks }] = await Promise.all([
    supabase
      .from('sms_gamev2_player_stats')
      .select('total_xp, total_coins, current_daily_streak, best_daily_streak, correct_answers_total, sessions_completed')
      .eq('student_id', studentId)
      .maybeSingle(),
    supabase.from('sms_gamev2_player_achievements').select('achievement_id, earned_at').eq('student_id', studentId).order('earned_at', { ascending: false }),
    supabase
      .from('sms_gamev2_question_set_completions')
      .select('question_set_id, completion_count, best_accuracy_pct, last_completed_at')
      .eq('student_id', studentId)
      .in('question_set_id', BUILTIN_SET_IDS),
    supabase
      .from('sms_gamev2_sessions')
      .select('id, question_set_id, engine_id, status, correct_count, answered_count, xp_earned, created_at, completed_at')
      .eq('student_id', studentId)
      .eq('status', 'COMPLETED')
      .order('completed_at', { ascending: false })
      .limit(60),
    supabase
      .from('sms_gamev2_sessions')
      .select('id, question_set_id, engine_id, status, answered_count, question_order, created_at')
      .eq('student_id', studentId)
      .in('status', ['READY', 'ACTIVE', 'PAUSED'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5),
    // Live Classroom sessions are resumed from the live lobby, not solo
    // play, so they never appear under "Continue".
    supabase.from('sms_gamev2_live_participants').select('session_id').eq('student_id', studentId).not('session_id', 'is', null),
  ])
  const liveSessionIds = new Set((liveLinks ?? []).map((l) => l.session_id as string))

  const progress = computeTopicProgress((completions ?? []) as CompletionRow[])
  const sessionRows = (sessions ?? []) as SessionRow[]
  const values = Array.from(progress.values())
  const practiced = values.filter((p) => p.status !== 'new')
  const answered = sessionRows.reduce((n, s) => n + s.answered_count, 0)
  const correct = sessionRows.reduce((n, s) => n + s.correct_count, 0)

  return {
    stats: {
      xp: stats?.total_xp ?? 0,
      coins: stats?.total_coins ?? 0,
      dailyStreak: stats?.current_daily_streak ?? 0,
      longestStreak: stats?.best_daily_streak ?? 0,
      correctAnswers: stats?.correct_answers_total ?? 0,
      gamesCompleted: stats?.sessions_completed ?? 0,
    },
    achievementIds: (achievements ?? []).map((a) => ({ id: a.achievement_id as string, earnedAt: a.earned_at as string })),
    topicProgress: Object.fromEntries(progress),
    boardProgress: LEARNING_BOARDS.map((b) => computeBoardProgress(b, progress)),
    recommendations: recommend(progress, sessionRows),
    recentActivity: recentBuiltinActivity(sessionRows),
    inProgress: (open ?? [])
      .filter((s) => !liveSessionIds.has(s.id as string))
      .slice(0, 3)
      .map((s) => ({
      id: s.id as string,
      questionSetId: s.question_set_id as string,
      engineId: s.engine_id as string,
      answered: s.answered_count as number,
      total: ((s.question_order as string[]) ?? []).length,
      updatedAt: s.created_at as string,
    })),
    topicsPracticed: practiced.length,
    topicsMastered: values.filter((p) => p.status === 'mastered').length,
    overallAccuracy: answered > 0 ? Math.round((correct / answered) * 100) : null,
  }
}
