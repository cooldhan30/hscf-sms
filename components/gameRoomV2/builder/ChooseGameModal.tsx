'use client'

import { GameV2Modal, GameV2Empty } from '@/components/gameRoomV2'
import { checkEngineCompatibility, type GameRoomQuestionType } from '@/lib/gameRoomV2/domain'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'

const ENGINE_ICON: Record<string, string> = {
  'classic-quiz': '❓',
  'tower-defense': '🏰',
  'boss-battle': '⚔️',
  'racing': '🏁',
  'treasure-quest': '🗺️',
  'word-ninja': '🥷',
  'space-mission': '🚀',
  'kingdom-builder': '🏯',
  'mystery-mansion': '🕵️',
  'crossword': '📝',
  'matching': '🧩',
  'memory': '🃏',
}

// "CHOOSE YOUR GAME" -- shown after selecting Play on a question set.
// Lists ONLY engines compatible with this set's question types
// (checkEngineCompatibility, the same calculation the Builder's
// CompatibilityResults panel uses) -- an incompatible engine never
// appears here at all, since there's nothing useful a teacher could do
// by picking one. Every listed engine is still status COMING_SOON (no
// V2 engine has real gameplay yet, per the foundation phase's explicit
// scope) -- clicking one shows a real "coming soon" state, never a
// fabricated launch into gameplay that doesn't exist.
export function ChooseGameModal({
  open,
  onClose,
  questionTypes,
  setTitle,
}: {
  open: boolean
  onClose: () => void
  questionTypes: GameRoomQuestionType[]
  setTitle: string
}) {
  const compatible = checkEngineCompatibility(GAME_ENGINES_V2, questionTypes).filter((r) => r.compatible)

  return (
    <GameV2Modal open={open} onClose={onClose} title="Choose Your Game">
      <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mb-4">
        Playable games for &quot;{setTitle}&quot;, based on its question types.
      </p>
      {compatible.length === 0 ? (
        <GameV2Empty title="No compatible games yet" description="This set's question types aren't supported by any registered game engine." />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {compatible.map(({ engine }) => (
            <div
              key={engine.id}
              className="rounded-2xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 p-4 text-center opacity-90"
            >
              <p className="text-3xl mb-2" aria-hidden>
                {ENGINE_ICON[engine.id] ?? '🎮'}
              </p>
              <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100 text-sm">{engine.name}</p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gamev2ink-100 dark:bg-gamev2ink-800 text-gamev2ink-500 dark:text-gamev2ink-400">
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      )}
    </GameV2Modal>
  )
}
