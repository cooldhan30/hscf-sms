'use client'

import { FiUsers, FiClock, FiSlash } from 'react-icons/fi'
import { GameV2Modal, GameV2StatusPill } from '@/components/gameRoomV2'
import { engineIcon } from '@/components/gameRoomV2/shell/ui'
import type { GameRoomQuestionType } from '@/lib/gameRoomV2/domain'
import { gamePickerForSet, type GameAvailability } from '@/lib/gameRoomV2/gameAvailability'
import Link from 'next/link'

// "Choose a game" for a teacher's question set (Library card / Builder
// wizard). Every ACTIVE game is listed (gamePickerForSet, the one shared
// availability rule): playable games first, then any active game this
// set can't play -- shown disabled with the reason, never silently
// dropped -- then a separate "Coming Soon" section. Live-capable games
// offer "Host Live"; solo play is a student action (sessions/start is
// student-only), so teachers see which games students can play on their
// own instead of a button that would fail.
export function ChooseGameModal({
  open,
  onClose,
  questionSetId,
  questionTypes,
  setTitle,
}: {
  open: boolean
  onClose: () => void
  questionSetId: string
  questionTypes: GameRoomQuestionType[]
  setTitle: string
}) {
  const picker = gamePickerForSet(questionTypes)

  return (
    <GameV2Modal open={open} onClose={onClose} title="Choose a Game" size="large">
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
        Games that can play &quot;{setTitle}&quot;. Host a live game for your class, or let students play it on their own.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="choose-game-active">
        {picker.active.map((a) => (
          <GameCard key={a.engine.id} availability={a} questionSetId={questionSetId} />
        ))}
      </div>

      {picker.comingSoon.length > 0 && (
        <div className="mt-6 pt-4 border-t border-stone-200 dark:border-stone-800" data-testid="choose-game-coming-soon">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-2 flex items-center gap-1.5">
            <FiClock className="w-3.5 h-3.5" aria-hidden /> Coming soon -- not playable yet
          </p>
          <ul className="flex flex-wrap gap-2">
            {picker.comingSoon.map((engine) => (
              <li
                key={engine.id}
                className="px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-xs text-stone-500 dark:text-stone-400"
              >
                {engine.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </GameV2Modal>
  )
}

function GameCard({ availability, questionSetId }: { availability: GameAvailability; questionSetId: string }) {
  const { engine, playable, reason } = availability
  const Icon = engineIcon(engine.id)
  return (
    <div
      data-game={engine.id}
      data-playable={playable ? 'true' : 'false'}
      aria-disabled={!playable}
      className={`rounded-2xl border p-4 ${
        playable ? 'border-stone-200 dark:border-stone-800' : 'border-dashed border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            playable ? 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300' : 'bg-stone-100 dark:bg-stone-800 text-stone-400'
          }`}
        >
          <Icon className="w-5 h-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className={`font-semibold ${playable ? 'text-stone-800 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`}>{engine.name}</p>
          {engine.tamilName && <p className="text-xs font-tamil text-stone-500 dark:text-stone-400">{engine.tamilName}</p>}
          <div className="mt-1 flex items-center gap-2">
            {playable ? (
              <>
                <GameV2StatusPill status={engine.status} />
                {engine.estimatedDurationMinutes && (
                  <span className="text-xs text-stone-500 dark:text-stone-400">~{engine.estimatedDurationMinutes} min</span>
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                <FiSlash className="w-3 h-3" aria-hidden /> Not for this set
              </span>
            )}
          </div>
        </div>
      </div>
      {!playable ? (
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400" data-reason>
          {reason?.en}
        </p>
      ) : engine.compatibility.liveClassroomSupport ? (
        <Link
          href={`/gameroom-v2/live/host?set=${encodeURIComponent(questionSetId)}&game=${encodeURIComponent(engine.id)}`}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-xl bg-primary-700 hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
        >
          <FiUsers className="w-4 h-4" aria-hidden /> Host Live
        </Link>
      ) : (
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">Students can play this on their own.</p>
      )}
    </div>
  )
}
