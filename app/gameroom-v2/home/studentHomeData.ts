import 'server-only'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'
import { ACHIEVEMENTS, getAchievement } from '@/lib/gameRoomV2/progression/achievements'
import { levelForXp } from '@/lib/gameRoomV2/progression'
import { dailyChallengeForDate } from '@/lib/gameRoomV2/progression/dailyChallenge'
import { allTopicSummaries, LEARNING_BOARDS } from '@/lib/gameRoomV2/builtin/summaries'
import type { StudentLearning } from '@/lib/gameRoomV2/builtin/studentLearning'
import type { createClient } from '@/lib/supabase/server'
import type { HomeScreenClient } from './HomeScreenClient'

// Curated starter topics shown as "Popular Topics" on the home screen.
const FEATURED_TOPIC_KEYS = ['uyir-ezhuthukkal', 'kuril-nedil', 'vilangugal', 'pazhangal', 'thinai', 'vakkiyam-amaithal']

export async function buildStudentHomeProps(
  supabase: ReturnType<typeof createClient>,
  studentId: string | null,
  firstName: string,
  learning: StudentLearning
): Promise<Parameters<typeof HomeScreenClient>[0]> {
  const topics = allTopicSummaries()
  const today = new Date().toISOString().slice(0, 10)
  const challenge = dailyChallengeForDate(today)
  let progress = 0
  let completed = false
  if (studentId) {
    const { data } = await supabase
      .from('sms_gamev2_daily_challenge_progress')
      .select('challenge_id, progress_count, completed_at')
      .eq('student_id', studentId)
      .eq('challenge_date', today)
      .maybeSingle()
    if (data && data.challenge_id === challenge.id) {
      progress = data.progress_count ?? 0
      completed = Boolean(data.completed_at)
    }
  }

  const playable = GAME_ENGINES_V2.filter((e) => e.status === 'ACTIVE' || e.status === 'BETA')
  return {
    firstName,
    level: levelForXp(learning.stats.xp).level,
    learning,
    topics,
    boards: LEARNING_BOARDS,
    featuredTopicKeys: FEATURED_TOPIC_KEYS,
    games: playable
      .map((e) => ({ id: e.id, name: e.name, topicCount: topics.filter((t) => t.engines.some((x) => x.engineId === e.id)).length }))
      .filter((g) => g.topicCount > 0),
    dailyChallenge: { name: challenge.name, description: challenge.description, progress, goal: challenge.goalCount, completed },
    earnedAchievements: learning.achievementIds
      .map((a) => getAchievement(a.id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => ({ id: a.id, name: a.name })),
    totalAchievements: ACHIEVEMENTS.length,
  }
}
