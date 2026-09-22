import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { FiLock } from 'react-icons/fi'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { AnalyticsClient } from './AnalyticsClient'

export const dynamic = 'force-dynamic'

// Teacher-facing GameRoom V2 learning analytics -- class accuracy,
// dimension/topic mastery, students needing practice, common mistakes,
// and improvement over time, computed from
// sms_gamev2_learning_events (migration 078). Deliberately tracks
// EDUCATIONAL performance, entirely separate from the game-performance
// surfaces (scores/leaderboards) elsewhere in GameRoom V2. Same access
// gate/no-nav-link convention as every other V2 route.
export default async function LearningAnalyticsPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/gameroom-v2/analytics')}`)
  }

  const access = await requireGameV2Teacher()
  if (!access.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center">
            <FiLock className="w-6 h-6 text-stone-500 dark:text-stone-400" />
          </div>
          <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-1">Not available yet</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            GameRoom V2 is still in development and isn&apos;t open to your account yet.
          </p>
        </div>
      </div>
    )
  }

  const { data: questionSets } = await access.supabase
    .from('sms_gamev2_question_sets')
    .select('id, title, tamil_title, question_count')
    .eq('created_by', access.profile.id)
    .order('updated_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 dark:from-gamev2ink-950 dark:to-gamev2ink-900 px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <AnalyticsClient
          questionSets={(questionSets ?? []).map((s) => ({
            id: s.id,
            title: s.title,
            tamilTitle: s.tamil_title,
            questionCount: s.question_count,
          }))}
        />
      </div>
    </div>
  )
}
