'use client'

import { GameV2Card } from '@/components/gameRoomV2'
import { TREASURE_QUEST_DIFFICULTY_SETTINGS, type TreasureQuestDifficulty } from '@/lib/gameRoomV2/treasureQuest'

// The pre-quest setup screen: just difficulty (gameplay parameters
// only -- question difficulty always comes from the session's Question
// Set). Unlike Tower Defense/Racing/Boss Battle, there's no additional
// visual-theme or boss/tower choice here -- Treasure Quest's rooms are
// a fixed layout, so difficulty is the only real pre-quest decision.
export function TreasureSetupPicker({ onStart }: { onStart: (difficulty: TreasureQuestDifficulty) => void }) {
  return (
    <GameV2Card padding="lg" className="max-w-xl w-full mx-auto text-center">
      <div className="text-5xl mb-2" aria-hidden>
        {'\u{1F5FA}️'}
      </div>
      <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Treasure Quest</h2>
      <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
        Explore room to room, answering correctly to earn keys. Unlock doors, uncover clues, and find the treasure.
      </p>

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2 text-left">
        Choose difficulty
      </p>
      <div className="grid gap-3">
        {TREASURE_QUEST_DIFFICULTY_SETTINGS.map((d) => (
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
