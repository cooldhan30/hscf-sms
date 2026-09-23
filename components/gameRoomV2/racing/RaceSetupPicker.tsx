'use client'

import { useState } from 'react'
import { GameV2Card, GameV2Button } from '@/components/gameRoomV2'
import { RACE_THEMES, RACING_DIFFICULTY_SETTINGS, type RaceThemeId, type RacingDifficulty } from '@/lib/gameRoomV2/racing'

// The pre-race setup screen: pick a visual theme (pure reskin, zero
// effect on physics) and a difficulty (gameplay parameters only --
// question difficulty always comes from the session's Question Set).
//
// `fixedDifficulty` is set only in Live Classroom multiplayer mode --
// the host already chose one shared difficulty for every racer (see
// migration 081's race_difficulty column), so a participant's own
// setup screen only asks for a theme (still a purely local/cosmetic
// choice, safe to leave per-student) and skips the difficulty section
// entirely, calling onStart with the server-fixed value instead of
// letting the student pick their own -- every racer's physics must be
// identical for the race to be a fair comparison.
export function RaceSetupPicker({
  onStart,
  fixedDifficulty,
}: {
  onStart: (theme: RaceThemeId, difficulty: RacingDifficulty) => void
  fixedDifficulty?: RacingDifficulty
}) {
  const [theme, setTheme] = useState<RaceThemeId>(RACE_THEMES[0].id)

  return (
    <GameV2Card padding="lg" className="max-w-xl w-full mx-auto text-center">
      <div className="text-5xl mb-2" aria-hidden>
        {'\u{1F3C1}'}
      </div>
      <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Tamil Racing</h2>
      <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
        Answer correctly to boost forward. Accuracy wins the race -- not how fast you tap.
      </p>

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2 text-left">
        Choose a theme
      </p>
      <div className="grid grid-cols-3 gap-2">
        {RACE_THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400 ${
              theme === t.id
                ? 'border-gamev2spark-500 bg-gamev2spark-50 dark:bg-gamev2spark-500/10'
                : 'border-gamev2ink-100 dark:border-gamev2ink-800 hover:border-gamev2ink-300'
            }`}
          >
            <span className="text-2xl" aria-hidden>
              {t.racerEmoji}
            </span>
            <span className="text-[11px] font-bold text-gamev2ink-800 dark:text-gamev2ink-100 leading-tight text-center">{t.tamilName}</span>
          </button>
        ))}
      </div>

      {fixedDifficulty ? (
        <div className="mt-6">
          <GameV2Button variant="spark" fullWidth onClick={() => onStart(theme, fixedDifficulty)}>
            Ready to Race
          </GameV2Button>
          <p className="mt-2 text-[11px] text-gamev2ink-400 dark:text-gamev2ink-500">
            Your teacher set this race to <strong>{RACING_DIFFICULTY_SETTINGS.find((d) => d.id === fixedDifficulty)?.label}</strong> difficulty for everyone.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2 text-left">
            Choose difficulty
          </p>
          <div className="grid gap-3">
            {RACING_DIFFICULTY_SETTINGS.map((d) => (
              <button
                key={d.id}
                onClick={() => onStart(theme, d.id)}
                className="text-left rounded-2xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 hover:border-gamev2spark-400 dark:hover:border-gamev2spark-500 bg-gamev2ink-50 dark:bg-gamev2ink-800/50 p-4 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400"
              >
                <p className="font-extrabold text-gamev2ink-900 dark:text-white">{d.label}</p>
                <p className="text-xs text-gamev2ink-500 dark:text-gamev2ink-400 mt-0.5">{d.description}</p>
              </button>
            ))}
          </div>
        </>
      )}

      <p className="mt-5 text-[11px] text-gamev2ink-400 dark:text-gamev2ink-500">
        Question difficulty always comes from your teacher&apos;s Question Set, not from this setting.
      </p>
    </GameV2Card>
  )
}
