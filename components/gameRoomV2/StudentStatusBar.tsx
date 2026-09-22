import { GameV2XPDisplay, GameV2CoinDisplay } from './HUD'
import { GameV2ProgressBar } from './ProgressBar'

// XP required to reach each level -- a simple fixed curve (200 XP/level)
// good enough for a brand-new student (0 XP, level 1) until a real
// leveling design/table exists. This is presentational math only, not
// a persisted rule -- no session/XP tables exist yet (see
// lib/gameRoomV2/README.md's foundation-phase scope), so every student
// viewing this page today is at level 1 / 0 XP, honestly.
const XP_PER_LEVEL = 200

function levelForXP(xp: number) {
  return Math.floor(xp / XP_PER_LEVEL) + 1
}

export function StudentStatusBar({
  name,
  xp,
  coins,
}: {
  name: string
  xp: number
  coins: number
}) {
  const level = levelForXP(xp)
  const xpIntoLevel = xp % XP_PER_LEVEL

  return (
    <div className="rounded-3xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-white dark:bg-gamev2ink-900 shadow-lg p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gamev2ink-600 to-gamev2ink-800 text-white flex items-center justify-center font-black text-xl flex-shrink-0">
            {level}
          </div>
          <div>
            <p className="font-extrabold text-gamev2ink-900 dark:text-white leading-tight">{name}</p>
            <p className="text-xs font-bold text-gamev2ink-400 dark:text-gamev2ink-500">Level {level}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GameV2XPDisplay xp={xp} />
          <GameV2CoinDisplay coins={coins} />
        </div>
      </div>
      <div className="mt-4">
        <GameV2ProgressBar value={xpIntoLevel} max={XP_PER_LEVEL} label={`Level ${level} → ${level + 1}`} tone="spark" />
      </div>
    </div>
  )
}
