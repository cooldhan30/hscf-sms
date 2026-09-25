import 'server-only'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'
import { ACHIEVEMENTS, getAchievement } from '@/lib/gameRoomV2/progression/achievements'
import { levelForXp } from '@/lib/gameRoomV2/progression'
import { dailyChallengeForDate } from '@/lib/gameRoomV2/progression/dailyChallenge'
import { allTopicSummaries, LEARNING_BOARDS } from '@/lib/gameRoomV2/builtin/summaries'
import { isBuiltinSetId } from '@/lib/gameRoomV2/builtin/catalog'
import { checkEngineCompatibility } from '@/lib/gameRoomV2/domain'
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

  // Sets teachers published for independent play (same rule as
  // /api/gameroom-v2/student/question-sets: published, non-empty, and
  // either class-less or in one of the student's active classes).
  let teacherSets: { id: string; title: string; tamilTitle: string | null; questionCount: number; engines: { id: string; name: string }[] }[] = []
  if (studentId) {
    const [{ data: sets }, { data: enrollments }] = await Promise.all([
      supabase
        .from('sms_gamev2_question_sets')
        .select('id, title, tamil_title, class_id, question_types, question_count')
        .eq('published', true)
        .gt('question_count', 0)
        .order('updated_at', { ascending: false })
        .limit(150),
      supabase.from('sms_class_enrollments').select('class_id').eq('student_id', studentId).eq('status', 'active'),
    ])
    const myClassIds = new Set((enrollments ?? []).map((e) => e.class_id))
    teacherSets = (sets ?? [])
      .filter((s) => !isBuiltinSetId(s.id) && (s.class_id === null || myClassIds.has(s.class_id)))
      .map((s) => ({
        id: s.id,
        title: s.title,
        tamilTitle: s.tamil_title,
        questionCount: s.question_count,
        engines: checkEngineCompatibility(playable, s.question_types ?? [])
          .filter((r) => r.compatible)
          .map((r) => ({ id: r.engine.id, name: r.engine.name })),
      }))
      .filter((s) => s.engines.length > 0)
      .slice(0, 12)
  }
  return {
    firstName,
    level: levelForXp(learning.stats.xp).level,
    learning,
    topics,
    boards: LEARNING_BOARDS,
    teacherSets,
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
