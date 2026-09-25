import { GameV2XPDisplay, GameV2CoinDisplay } from './HUD'
import { GameV2ProgressBar } from './ProgressBar'
import { levelForXp } from '@/lib/gameRoomV2/progression'

// Level/XP-into-level are derived from the ONE shared curve in
// lib/gameRoomV2/progression/levels.ts (the same function the server's
// GET /api/gameroom-v2/progression route and the reward service use) --
// this component used to compute its own separate, flat 200-XP/level
// curve, which would have silently drifted from the server's real
// numbers the moment either one changed. There is now exactly one
// level curve in the whole codebase.
export function StudentStatusBar({
  name,
  xp,
  coins,
  dailyStreak = 0,
}: {
  name: string
  xp: number
  coins: number
  // Consecutive-DAYS practice streak (sms_gamev2_player_stats.
  // current_daily_streak) -- distinct from an in-session answer streak.
  // Optional/defaulted so every existing caller (e.g. the design
  // gallery's fabricated-data demo) keeps compiling without needing to
  // invent a streak number of its own.
  dailyStreak?: number
}) {
  const { level, xpIntoCurrentLevel, xpNeededForNextLevel } = levelForXp(xp)

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
            {level}
          </div>
          <div>
            <p className="font-bold text-primary-900 dark:text-white leading-tight">{name}</p>
            <p className="text-xs font-bold text-stone-400 dark:text-stone-500">Level {level}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dailyStreak > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300">
              {dailyStreak}-day streak
            </span>
          )}
          <GameV2XPDisplay xp={xp} />
          <GameV2CoinDisplay coins={coins} />
        </div>
      </div>
      <div className="mt-4">
        <GameV2ProgressBar value={xpIntoCurrentLevel} max={xpNeededForNextLevel} label={`Level ${level} → ${level + 1}`} tone="spark" />
      </div>
    </div>
  )
}
