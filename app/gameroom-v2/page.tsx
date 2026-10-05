import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { loadGameRoomPage } from '@/lib/gameRoomV2/builtin/pageContext'
import { HomeScreenClient } from './home/HomeScreenClient'
import { buildStudentLauncher, buildTeacherLauncher } from './home/launcherData'
import { TeacherHome } from './TeacherHome'

export const dynamic = 'force-dynamic'

// GameRoom home. /gameroom (the sidebar entry) lands here directly while
// V2 is released. Everyone gets the same four-choice launcher (topic,
// game, questions, time); students then Play, teachers and admins start a
// live game for their class and manage their own questions at the top.
// ?topic=<key> preselects a topic (e.g. from a topic page). Rendered
// inside the app's normal DashboardLayout (GameRoomShell).
export default async function GameRoomV2Page({ searchParams }: { searchParams: { topic?: string } }) {
  const ctx = await loadGameRoomPage('/gameroom-v2', { withLearning: false })
  if (!ctx.ok) {
    return (
      <GameRoomShell>
        <GameRoomUnavailable message={ctx.error} />
      </GameRoomShell>
    )
  }

  const initialTopicKey = typeof searchParams.topic === 'string' ? searchParams.topic : null

  if (ctx.role === 'student') {
    const props = await buildStudentLauncher(ctx.supabase, ctx.studentId, ctx.firstName)
    return (
      <GameRoomShell>
        <HomeScreenClient {...props} initialTopicKey={initialTopicKey} />
      </GameRoomShell>
    )
  }

  const props = await buildTeacherLauncher(ctx.supabase, ctx.userId, ctx.role === 'admin', ctx.firstName)
  return (
    <GameRoomShell>
      <TeacherHome {...props} initialTopicKey={initialTopicKey} />
    </GameRoomShell>
  )
}
