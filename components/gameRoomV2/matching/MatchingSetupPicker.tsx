'use client'

import { FiLink } from 'react-icons/fi'
import { GameV2Card } from '@/components/gameRoomV2'
import { MATCHING_DIFFICULTY_SETTINGS, type MatchingDifficulty } from '@/lib/gameRoomV2/matching'

// The pre-round setup screen: pace only (the round timer) -- never
// question difficulty, which always comes from the session's Question Set.
const PACE_TA: Record<MatchingDifficulty, string> = { casual: 'நிதானம்', quick: 'விரைவு', speedster: 'அதிவேகம்' }

export function MatchingSetupPicker({ onStart }: { onStart: (difficulty: MatchingDifficulty) => void }) {
  return (
    <GameV2Card padding="lg" className="max-w-xl w-full mx-auto text-center">
      <FiLink className="w-10 h-10 mx-auto mb-2 text-gamev2spark-500" aria-hidden />
      <h2 className="font-tamil leading-snug text-2xl font-extrabold text-gamev2ink-900 dark:text-white">பொருத்துக</h2>
      <p className="text-sm font-semibold text-gamev2ink-500">Matching</p>
      <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
        <span className="font-tamil block text-gamev2ink-700 dark:text-gamev2ink-200">இடப்பக்க அட்டையைத் தொட்டு, வலப்பக்கத்தில் அதன் இணையைத் தொடுங்கள். எல்லா இணைகளையும் முதல் முயற்சியிலேயே சரியாகப் பொருத்தினால் மூன்று நட்சத்திரங்கள்.</span>
        Tap a card on the left, then its partner on the right. Get every pair right first time for three stars -- on
        Quick and Speedster, beat the clock too. Every round gets a little faster.
      </p>

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2 text-left">
        <span className="font-tamil normal-case tracking-normal text-sm">வேகத்தைத் தேர்ந்தெடுங்கள்</span> · Choose your pace
      </p>
      <div className="grid gap-3">
        {MATCHING_DIFFICULTY_SETTINGS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onStart(d.id)}
            className="text-left rounded-2xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 hover:border-gamev2spark-400 dark:hover:border-gamev2spark-500 bg-gamev2ink-50 dark:bg-gamev2ink-800/50 p-4 min-h-[44px] transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400"
          >
            <p className="font-extrabold text-gamev2ink-900 dark:text-white"><span className="font-tamil">{PACE_TA[d.id]}</span> <span className="text-xs font-semibold opacity-70">· {d.label}</span></p>
            <p className="font-tamil text-xs text-gamev2ink-500 dark:text-gamev2ink-400 mt-0.5">{d.description}</p>
          </button>
        ))}
      </div>

      <p className="mt-5 text-[11px] text-gamev2ink-400 dark:text-gamev2ink-500">
        <span className="font-tamil">கேள்விகளின் கடினம் உங்கள் ஆசிரியரின் கேள்வித் தொகுப்பைப் பொறுத்தது.</span>
      </p>
    </GameV2Card>
  )
}
