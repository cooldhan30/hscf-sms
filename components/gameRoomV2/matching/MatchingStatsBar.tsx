'use client'

// A compact stats readout -- moves, current streak, and (when timed)
// remaining seconds on the round. Kept separate from the shared
// GameHUD (which tracks the session's own question timer/XP/coins) so
// Matching's round-local stats don't get confused with the
// session-level ones.
export function MatchingStatsBar({ moves, currentStreak, roundSecondsRemaining }: { moves: number; currentStreak: number; roundSecondsRemaining: number | null }) {
  return (
    <div className="w-full max-w-xl mx-auto flex items-center justify-center gap-3 sm:gap-4 flex-wrap" role="group" aria-label="Round stats">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gamev2ink-50 dark:bg-gamev2ink-800/60 border border-gamev2ink-100 dark:border-gamev2ink-700" aria-label={`Moves: ${moves}`}>
        <span aria-hidden>{'\u{1F504}'}</span>
        <span className="text-xs font-extrabold text-gamev2ink-800 dark:text-white tabular-nums">{moves} moves</span>
      </div>
      {currentStreak > 1 && (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gamev2spark-100 dark:bg-gamev2spark-500/20 text-gamev2spark-700 dark:text-gamev2spark-300">
          {'\u{1F525}'} {currentStreak} streak
        </div>
      )}
      {roundSecondsRemaining !== null && (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-extrabold text-xs tabular-nums ${
            roundSecondsRemaining <= 5
              ? 'bg-gamev2coral-50 dark:bg-gamev2coral-500/10 border-gamev2coral-200 dark:border-gamev2coral-500/30 text-gamev2coral-600 dark:text-gamev2coral-300'
              : 'bg-gamev2ink-50 dark:bg-gamev2ink-800/60 border-gamev2ink-100 dark:border-gamev2ink-700 text-gamev2ink-800 dark:text-white'
          }`}
          aria-label={`${roundSecondsRemaining} seconds remaining in this round`}
        >
          <span aria-hidden>{'⏱️'}</span>
          {roundSecondsRemaining}s
        </div>
      )}
    </div>
  )
}
