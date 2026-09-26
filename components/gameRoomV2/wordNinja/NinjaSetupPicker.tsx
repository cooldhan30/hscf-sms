'use client'

import { WORD_NINJA_DIFFICULTY_SETTINGS, NINJA_TUNING, type WordNinjaDifficulty } from '@/lib/gameRoomV2/wordNinja'

const BLURB: Record<WordNinjaDifficulty, string> = {
  easy: 'Slow falls, two words at a time, 6 hearts. Take time to read.',
  normal: 'A steady pace that speeds up as you slash, 5 hearts.',
  hard: 'Fast falls, up to four words in the air, 4 hearts.',
}

// The pre-run setup screen. Difficulty only changes the arcade (fall
// speed, words in the air, hearts); the words and categories always come
// from the session's CATEGORIZE Question Set.
export function NinjaSetupPicker({ onStart }: { onStart: (difficulty: WordNinjaDifficulty) => void }) {
  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6">
      <div className="rounded-3xl bg-gradient-to-b from-indigo-950 to-slate-950 border border-white/10 p-6 text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Word Ninja</p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">The Word Dojo</h1>
        <p className="font-tamil leading-relaxed text-lg text-indigo-200">சொல் பயிற்சிக் கூடம்</p>
        <ul className="mt-4 space-y-2 text-sm text-slate-200">
          <li>Words fall through the dojo. Slash each one into its lane before it hits the floor -- tap a lane button, or press 1, 2, 3...</li>
          <li>A word that lands costs a heart and falls again. Slash high and fast to build your combo; golden words are worth triple.</li>
          <li>Every round is checked when all its words are sorted. A clean round earns a power-up; a word in the wrong lane costs two hearts.</li>
          <li>Powers: Slow Time (Z) and Shield (X), earned from combos, golden words and clean rounds.</li>
        </ul>
        <div className="mt-5 grid gap-2" role="radiogroup" aria-label="Difficulty">
          {WORD_NINJA_DIFFICULTY_SETTINGS.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={false}
              onClick={() => onStart(d.id)}
              className="text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 p-3 min-h-[44px] flex items-center gap-3"
            >
              <span className="flex-1">
                <span className="block font-semibold">{d.label}</span>
                <span className="block text-xs text-slate-300">{BLURB[d.id]}</span>
              </span>
              <span className="text-xs text-rose-300 tabular-nums" aria-label={`${NINJA_TUNING[d.id].lives} hearts`}>
                {NINJA_TUNING[d.id].lives} hearts
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
