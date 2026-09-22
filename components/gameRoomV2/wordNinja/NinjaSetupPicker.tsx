'use client'

import { GameV2Card } from '@/components/gameRoomV2'
import { WORD_NINJA_DIFFICULTY_SETTINGS, type WordNinjaDifficulty } from '@/lib/gameRoomV2/wordNinja'

// The pre-round setup screen: just difficulty (flight speed/word count
// only -- content always comes from the session's CATEGORIZE Question
// Set, e.g. பெயர்ச்சொல்/வினைச்சொல், ஒருமை/பன்மை,
// உயர்திணை/அஃறிணை, வல்லினம்/மெல்லினம்/இடையினம், or any other
// teacher-authored category set).
export function NinjaSetupPicker({ onStart }: { onStart: (difficulty: WordNinjaDifficulty) => void }) {
  return (
    <GameV2Card padding="lg" className="max-w-xl w-full mx-auto text-center">
      <div className="text-5xl mb-2" aria-hidden>
        {'\u{1F977}'}
      </div>
      <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Word Ninja</h2>
      <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
        Words fly across the screen. Slash each one into the category lane it belongs to.
      </p>

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2 text-left">
        Choose difficulty
      </p>
      <div className="grid gap-3">
        {WORD_NINJA_DIFFICULTY_SETTINGS.map((d) => (
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
        The categories in each round always come from your teacher&apos;s Question Set.
      </p>
    </GameV2Card>
  )
}
