'use client'

import { GameV2Card } from '@/components/gameRoomV2'
import { SPACE_MISSION_DIFFICULTY_SETTINGS, type SpaceMissionDifficulty } from '@/lib/gameRoomV2/spaceMission'

// The pre-flight briefing: difficulty only (gameplay parameters --
// thrust/shield wear -- never question difficulty, which always comes
// from the session's Question Set), matching Treasure Quest's
// single-decision setup screen precedent.
export function MissionSetupPicker({ onStart }: { onStart: (difficulty: SpaceMissionDifficulty) => void }) {
  return (
    <GameV2Card padding="lg" className="max-w-xl w-full mx-auto text-center">
      <div className="text-5xl mb-2" aria-hidden>
        {'\u{1F680}'}
      </div>
      <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Space Mission</h2>
      <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
        Answer correctly to fire your thrusters and fly from planet to planet. Wrong answers drain your shields -- but
        never end the mission.
      </p>

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2 text-left">
        Choose your flight plan
      </p>
      <div className="grid gap-3">
        {SPACE_MISSION_DIFFICULTY_SETTINGS.map((d) => (
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
