'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GameV2Modal, GameV2Empty, GameV2StatusPill } from '@/components/gameRoomV2'
import { checkEngineCompatibility, type GameRoomQuestionType } from '@/lib/gameRoomV2/domain'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'
import { toast } from '@/lib/toast'
import { HostLiveModal } from '@/components/gameRoomV2/liveClassroom/HostLiveModal'

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
// by picking one. Most engines are still status COMING_SOON (no real
// gameplay exists -- see lib/gameRoomV2/registry.ts) and stay inert
// with a "Coming Soon" badge; only an ACTIVE/BETA engine (today: just
// Classic Quiz, the framework's thin reference engine) is clickable,
// and clicking it starts a REAL session via
// /api/gameroom-v2/sessions/start -- never a fabricated launch.
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
  const router = useRouter()
  const [starting, setStarting] = useState<string | null>(null)
  const [hostingEngineId, setHostingEngineId] = useState<string | null>(null)
  const compatible = checkEngineCompatibility(GAME_ENGINES_V2, questionTypes).filter((r) => r.compatible)

  async function handlePlay(engineId: string) {
    setStarting(engineId)
    const res = await fetch('/api/gameroom-v2/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionSetId, engineId }),
    })
    const data = await res.json().catch(() => ({}))
    setStarting(null)

    if (!res.ok) {
      toast.error(data.error || 'Failed to start game')
      return
    }
    router.push(`/gameroom-v2/play/${data.sessionId}`)
  }

  return (
    <GameV2Modal open={open} onClose={onClose} title="Choose Your Game">
      <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mb-4">
        Playable games for &quot;{setTitle}&quot;, based on its question types.
      </p>
      {compatible.length === 0 ? (
        <GameV2Empty title="No compatible games yet" description="This set's question types aren't supported by any registered game engine." />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {compatible.map(({ engine }) => {
            const isPlayable = engine.status === 'ACTIVE' || engine.status === 'BETA'
            return (
              <div
                key={engine.id}
                className={`rounded-2xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 p-4 text-center ${!isPlayable ? 'opacity-70' : ''}`}
              >
                <button
                  type="button"
                  disabled={!isPlayable || starting !== null}
                  onClick={() => handlePlay(engine.id)}
                  className={`w-full ${isPlayable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  <p className="text-3xl mb-2" aria-hidden>
                    {ENGINE_ICON[engine.id] ?? '🎮'}
                  </p>
                  <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100 text-sm">{engine.name}</p>
                  <div className="mt-2 flex justify-center">
                    <GameV2StatusPill status={starting === engine.id ? 'ACTIVE' : engine.status} />
                  </div>
                </button>
                {isPlayable && engine.compatibility.liveClassroomSupport && (
                  <button
                    type="button"
                    onClick={() => setHostingEngineId(engine.id)}
                    className="mt-3 w-full text-xs font-bold text-gamev2spark-600 dark:text-gamev2spark-400 hover:underline"
                  >
                    Host Live &rarr;
                  </button>
                )}
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
