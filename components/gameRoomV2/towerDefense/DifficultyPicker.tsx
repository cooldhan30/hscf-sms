'use client'

import { GameV2Card } from '@/components/gameRoomV2'
import { DIFFICULTY_SETTINGS, type TowerDefenseDifficulty } from '@/lib/gameRoomV2/towerDefense'

// The pre-game difficulty screen. Difficulty here alters ONLY gameplay
// parameters (enemy speed/health, starting coins, wave size) -- it is
// never sent anywhere near question selection, which the session's
// linked Question Set controls entirely on its own.
export function DifficultyPicker({ onStart }: { onStart: (difficulty: TowerDefenseDifficulty) => void }) {
  return (
    <GameV2Card padding="lg" className="max-w-xl w-full mx-auto text-center">
      <div className="text-5xl mb-2" aria-hidden>
        🏯
      </div>
      <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Tamil Tower Defense</h2>
      <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
        Answer questions correctly to earn coins, build towers, and stop every wave before they reach your fort.
      </p>

      <div className="mt-6 grid gap-3">
        {DIFFICULTY_SETTINGS.map((d) => (
          <button
            key={d.id}
            onClick={() => onStart(d.id)}
            className="text-left rounded-2xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 hover:border-gamev2spark-400 dark:hover:border-gamev2spark-500 bg-gamev2ink-50 dark:bg-gamev2ink-800/50 p-4 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400"
          >
            <p className="font-extrabold text-gamev2ink-900 dark:text-white">{d.label}</p>
            <p className="text-xs text-gamev2ink-500 dark:text-gamev2ink-400 mt-0.5">{d.description}</p>
          </button>
        ))}
      </div>

      <p className="mt-5 text-[11px] text-gamev2ink-400 dark:text-gamev2ink-500">
        Question difficulty always comes from your teacher&apos;s Question Set, not from this setting.
      </p>
    </GameV2Card>
  )
}
