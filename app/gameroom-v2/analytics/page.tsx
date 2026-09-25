import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { AnalyticsClient } from './AnalyticsClient'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'

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
      <GameRoomShell>
        <GameRoomUnavailable message={access.error} />
      </GameRoomShell>
    )
  }

  const { data: questionSets } = await access.supabase
    .from('sms_gamev2_question_sets')
    .select('id, title, tamil_title, question_count')
    .eq('created_by', access.profile.id)
    .order('updated_at', { ascending: false })

  return (
    <GameRoomShell>
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
    </GameRoomShell>
  )
}
