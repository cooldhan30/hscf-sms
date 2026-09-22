'use client'

// A compact stats readout -- moves and current streak. No timer (see
// lib/gameRoomV2/memory/difficulty.ts's header note: Memory
// deliberately has no round timer, unlike Matching).
export function MemoryStatsBar({ moves, currentStreak }: { moves: number; currentStreak: number }) {
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
    </div>
  )
}
