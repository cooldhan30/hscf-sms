import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { loadGameRoomPage } from '@/lib/gameRoomV2/builtin/pageContext'
import { isBuiltinSetId } from '@/lib/gameRoomV2/builtin/catalog'
import { HomeScreenClient } from './home/HomeScreenClient'
import { buildStudentHomeProps } from './home/studentHomeData'
import { TeacherHome } from './TeacherHome'

export const dynamic = 'force-dynamic'

// GameRoom home. /gameroom (the sidebar entry) lands here directly while
// V2 is released. Students get the Tamil learning dashboard; teachers and
// admins get the teacher home. Rendered inside the app's normal
// DashboardLayout (GameRoomShell).
export default async function GameRoomV2Page() {
  const ctx = await loadGameRoomPage('/gameroom-v2')
  if (!ctx.ok) {
    return (
      <GameRoomShell>
        <GameRoomUnavailable message={ctx.error} />
      </GameRoomShell>
    )
  }

  if (ctx.role === 'student') {
    const props = await buildStudentHomeProps(ctx.supabase, ctx.studentId, ctx.firstName, ctx.learning!)
    return (
      <GameRoomShell>
        <HomeScreenClient {...props} />
      </GameRoomShell>
    )
  }

  // RLS scopes this to own sets + SCHOOL/PUBLIC shared sets.
  const { data: sets } = await ctx.supabase.from('sms_gamev2_question_sets').select('id, created_by')
  const rows = (sets ?? []).filter((s) => !isBuiltinSetId(s.id))
  const mySetCount = rows.filter((s) => s.created_by === ctx.userId).length

  return (
    <GameRoomShell>
      <TeacherHome mySetCount={mySetCount} sharedSetCount={rows.length - mySetCount} />
    </GameRoomShell>
  )
}
