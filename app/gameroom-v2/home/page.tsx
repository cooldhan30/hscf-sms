import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { FiLock } from 'react-icons/fi'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { ACHIEVEMENTS, getAchievement } from '@/lib/gameRoomV2/progression/achievements'
import { HomeScreenClient, type HomeProgressionData } from './HomeScreenClient'

export const dynamic = 'force-dynamic'

// The GameRoom V2 student arcade home screen. Same top-level-route,
// data-gated-access pattern as /gameroom-v2 and /gameroom-v2/design
// (see lib/gameRoomV2/requireAccess.ts) -- not linked from any nav,
// not reachable via any role-prefixed middleware redirect, and not
// wired into legacy GameRoom in any way.
//
// The greeting uses the caller's real first_name (from sms_profiles,
// already fetched by requireGameV2Access()). XP/coins/level/streak/
// achievements are now real, fetched here server-side from
// sms_gamev2_player_stats/sms_gamev2_player_achievements (migration
// 077) -- requireGameV2Access() itself allows any active role (a
// non-student tester/admin can view this page too), so a caller with
// no sms_students row simply sees the honest zero/empty state rather
// than an error.
export default async function GameRoomV2HomePage() {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/gameroom-v2/home')}`)
  }

  const access = await requireGameV2Access()

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

  const displayName = access.profile.first_name || 'Player'

  const { data: student } = await access.supabase.from('sms_students').select('id').eq('profile_id', userId).maybeSingle()

  let progression: HomeProgressionData = {
    xp: 0,
    coins: 0,
    currentDailyStreak: 0,
    earnedAchievements: [],
  }

  if (student) {
    const [{ data: stats }, { data: achievementRows }] = await Promise.all([
      access.supabase
        .from('sms_gamev2_player_stats')
        .select('total_xp, total_coins, current_daily_streak')
        .eq('student_id', student.id)
        .maybeSingle(),
      access.supabase.from('sms_gamev2_player_achievements').select('achievement_id').eq('student_id', student.id),
    ])

    progression = {
      xp: stats?.total_xp ?? 0,
      coins: stats?.total_coins ?? 0,
      currentDailyStreak: stats?.current_daily_streak ?? 0,
      earnedAchievements: (achievementRows ?? [])
        .map((r) => getAchievement(r.achievement_id))
        .filter((a): a is NonNullable<typeof a> => a !== undefined)
        .map((a) => ({ id: a.id, name: a.name, icon: a.icon })),
    }
  }

  // Preview the next few unearned achievements (not the full catalog --
  // this section is a teaser, the full list lives on a future
  // dedicated achievements page) so a brand-new student sees exactly
  // what a real, locked GameV2Badge preview looks like rather than a
  // hand-picked fake list.
  const earnedIds = new Set(progression.earnedAchievements.map((a) => a.id))
  const previewLocked = ACHIEVEMENTS.filter((a) => !earnedIds.has(a.id))
    .slice(0, 5)
    .map((a) => ({ id: a.id, name: a.name, icon: a.icon }))

  return <HomeScreenClient studentName={displayName} progression={progression} previewLockedAchievements={previewLocked} />
}
