'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiUser, FiUsers } from 'react-icons/fi'
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

// "CHOOSE YOUR GAME" -- shown after choosing to play a question set,
// either from the Library card's "Play" button or the Builder
// wizard's own "Play or Host Live" step. Lists ONLY engines compatible
// with this set's question types (checkEngineCompatibility, the same
// calculation the Builder's CompatibilityResults panel uses) -- an
// incompatible engine never appears here at all, since there's nothing
// useful a teacher could do by picking one. Most of the 12 registered
// engines are ACTIVE and genuinely playable today (see
// lib/gameRoomV2/registry.ts); a still-COMING_SOON engine stays inert
// with a "Coming Soon" badge and neither button is clickable for it.
//
// Every compatible, playable engine offers TWO equally-weighted paths,
// never one primary + one secondary link -- a teacher should never have
// to guess which one is "the real button": "Play Solo" starts a REAL
// session for the teacher's own account only (via
// /api/gameroom-v2/sessions/start, routing to /gameroom-v2/play/[id]) --
// useful for previewing the game or letting one student play
// individually; "Host Live" opens HostLiveModal to create a Live
// Classroom session with a join code for the whole class. Neither
// button is a fabricated/disabled placeholder -- if a button is shown
// enabled, clicking it launches something real.
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

  async function handlePlaySolo(engineId: string) {
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
      <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mb-1">
        Playable games for &quot;{setTitle}&quot;, based on its question types.
      </p>
      <p className="text-xs text-gamev2ink-400 dark:text-gamev2ink-500 mb-4 flex items-center gap-3">
        <span className="flex items-center gap-1">
          <FiUser className="w-3.5 h-3.5" /> Play Solo — just you, right now
        </span>
        <span className="flex items-center gap-1">
          <FiUsers className="w-3.5 h-3.5" /> Host Live — a join code for your whole class
        </span>
      </p>
      {compatible.length === 0 ? (
        <GameV2Empty title="No compatible games yet" description="This set's question types aren't supported by any registered game engine." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {compatible.map(({ engine }) => {
            const isPlayable = engine.status === 'ACTIVE' || engine.status === 'BETA'
            const supportsLive = isPlayable && engine.compatibility.liveClassroomSupport
            return (
              <div
                key={engine.id}
                className={`rounded-2xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 p-4 text-center ${!isPlayable ? 'opacity-70' : ''}`}
              >
                <p className="text-3xl mb-2" aria-hidden>
                  {ENGINE_ICON[engine.id] ?? '🎮'}
                </p>
                <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100 text-sm">{engine.name}</p>
                <div className="mt-1.5 flex items-center justify-center gap-2">
                  <GameV2StatusPill status={starting === engine.id ? 'ACTIVE' : engine.status} />
                  {isPlayable && <span className="text-[11px] font-bold text-gamev2ink-400 dark:text-gamev2ink-500">~{engine.estimatedDurationMinutes} min</span>}
                </div>

                {isPlayable && (
                  <div className={`mt-3 grid gap-2 ${supportsLive ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <button
                      type="button"
                      disabled={starting !== null}
                      onClick={() => handlePlaySolo(engine.id)}
                      className="flex items-center justify-center gap-1 rounded-xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 px-2 py-2 text-xs font-bold text-gamev2ink-700 dark:text-gamev2ink-200 hover:border-gamev2ink-400 dark:hover:border-gamev2ink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <FiUser className="w-3.5 h-3.5" /> {starting === engine.id ? 'Starting...' : 'Play Solo'}
                    </button>
                    {supportsLive && (
                      <button
                        type="button"
                        disabled={starting !== null}
                        onClick={() => setHostingEngineId(engine.id)}
                        className="flex items-center justify-center gap-1 rounded-xl border-2 border-gamev2spark-400 dark:border-gamev2spark-500 bg-gamev2spark-50 dark:bg-gamev2spark-500/10 px-2 py-2 text-xs font-bold text-gamev2spark-700 dark:text-gamev2spark-300 hover:bg-gamev2spark-100 dark:hover:bg-gamev2spark-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <FiUsers className="w-3.5 h-3.5" /> Host Live
                      </button>
                    )}
                  </div>
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
