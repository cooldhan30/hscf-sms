'use client'

import { GameV2Card } from '@/components/gameRoomV2'
import { MEMORY_DIFFICULTY_SETTINGS, type MemoryDifficulty } from '@/lib/gameRoomV2/memory'

// The pre-round setup screen: difficulty only (gameplay parameters --
// mismatch-reveal duration/streak bonus -- never question difficulty,
// which always comes from the session's Question Set), matching every
// prior engine's single-decision setup precedent.
export function MemorySetupPicker({ onStart }: { onStart: (difficulty: MemoryDifficulty) => void }) {
  return (
    <GameV2Card padding="lg" className="max-w-xl w-full mx-auto text-center">
      <div className="text-5xl mb-2" aria-hidden>
        {'\u{1F9E0}'}
      </div>
      <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Memory</h2>
      <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
        Flip two cards at a time and remember where each pair is hiding. No timer -- just your recall.
      </p>

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2 text-left">
        Choose your challenge
      </p>
      <div className="grid gap-3">
        {MEMORY_DIFFICULTY_SETTINGS.map((d) => (
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
