'use client'

import { useState } from 'react'
import { FiUsers } from 'react-icons/fi'
import { GameV2Modal, GameV2Empty, GameV2StatusPill } from '@/components/gameRoomV2'
import { engineIcon } from '@/components/gameRoomV2/shell/ui'
import { checkEngineCompatibility, type GameRoomQuestionType } from '@/lib/gameRoomV2/domain'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'
import { HostLiveModal } from '@/components/gameRoomV2/liveClassroom/HostLiveModal'

// "Choose a game" for a teacher's question set (Library card / Builder
// wizard). Lists ONLY engines compatible with the set's question types
// (checkEngineCompatibility). Live-capable engines offer "Host Live",
// which creates a Live Classroom session with a join code. Solo play is
// a student action (sessions/start is student-only), so teachers see
// which games their students can play on their own instead of a button
// that would fail -- to try the questions yourself, use Preview.
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
  const [hostingEngineId, setHostingEngineId] = useState<string | null>(null)
  const compatible = checkEngineCompatibility(GAME_ENGINES_V2, questionTypes).filter((r) => r.compatible)

  return (
    <GameV2Modal open={open} onClose={onClose} title="Choose a Game" size="large">
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
        Games that can play &quot;{setTitle}&quot;. Host a live game for your class, or let students play it on their own.
      </p>
      {compatible.length === 0 ? (
        <GameV2Empty title="No compatible games yet" description="This set's question types aren't supported by any game yet." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {compatible.map(({ engine }) => {
            const isPlayable = engine.status === 'ACTIVE' || engine.status === 'BETA'
            const supportsLive = isPlayable && engine.compatibility.liveClassroomSupport
            const Icon = engineIcon(engine.id)
            return (
              <div key={engine.id} className={`rounded-2xl border border-stone-200 dark:border-stone-800 p-4 ${!isPlayable ? 'opacity-70' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-800 dark:text-stone-100">{engine.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <GameV2StatusPill status={engine.status} />
                      {isPlayable && engine.estimatedDurationMinutes && (
                        <span className="text-xs text-stone-500 dark:text-stone-400">~{engine.estimatedDurationMinutes} min</span>
                      )}
                    </div>
                  </div>
                </div>
                {isPlayable &&
                  (supportsLive ? (
                    <button
                      type="button"
                      onClick={() => setHostingEngineId(engine.id)}
                      className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-xl bg-primary-700 hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
                    >
                      <FiUsers className="w-4 h-4" aria-hidden /> Host Live
                    </button>
                  ) : (
                    <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">Students can play this on their own.</p>
                  ))}
              </div>
            )
          })}
        </div>
      )}

      {hostingEngineId && (
        <HostLiveModal
          open={Boolean(hostingEngineId)}
          onClose={() => setHostingEngineId(null)}
          questionSetId={questionSetId}
          engineId={hostingEngineId}
          setTitle={setTitle}
        />
      )}
    </GameV2Modal>
  )
}
