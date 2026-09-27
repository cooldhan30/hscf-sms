'use client'

import { useEffect, useState, type ComponentType } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { GameV2Loading } from '@/components/gameRoomV2'
import { ta } from '@/components/gameRoomV2/Bi'

// Most engines have no visual layer of their own and mount
// GameSessionRuntime directly (the "thin reference engine" path). Tower
// Defense, Racing, Boss Battle, Treasure Quest, Word Ninja and the rest
// each want a different visual frame around the question -- a
// battlefield, race track, arena, room map, or flight board instead of a
// plain centered card -- so this is the one branch point: a single
// lightweight /state call reveals which engine owns the session, then the
// right top-level component takes over.
//
// Every engine is loaded with next/dynamic, so each one is its own chunk
// and a student downloads ONLY the engine they're actually playing. This
// page used to import all ten statically, shipping every engine's
// components and simulation code to every player. Every future engine
// that needs its own board gets an entry in ENGINE_COMPONENTS the same way.
type EngineProps = { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }

const engineLoading = () => <GameV2Loading label={ta('loadingGame', true)} />

const ENGINE_COMPONENTS: Record<string, ComponentType<EngineProps>> = {
  'tower-defense': dynamic(() => import('@/components/gameRoomV2/towerDefense/TowerDefenseGame').then((m) => m.TowerDefenseGame), {
    loading: engineLoading,
  }),
  racing: dynamic(() => import('@/components/gameRoomV2/racing/RacingGame').then((m) => m.RacingGame), { loading: engineLoading }),
  'boss-battle': dynamic(() => import('@/components/gameRoomV2/bossBattle/BossBattleGame').then((m) => m.BossBattleGame), {
    loading: engineLoading,
  }),
  'treasure-quest': dynamic(() => import('@/components/gameRoomV2/treasureQuest/TreasureQuestGame').then((m) => m.TreasureQuestGame), {
    loading: engineLoading,
  }),
  'word-ninja': dynamic(() => import('@/components/gameRoomV2/wordNinja/WordNinjaGame').then((m) => m.WordNinjaGame), { loading: engineLoading }),
  'space-mission': dynamic(() => import('@/components/gameRoomV2/spaceMission/SpaceMissionGame').then((m) => m.SpaceMissionGame), {
    loading: engineLoading,
  }),
  'kingdom-builder': dynamic(() => import('@/components/gameRoomV2/kingdomBuilder/KingdomBuilderGame').then((m) => m.KingdomBuilderGame), {
    loading: engineLoading,
  }),
  'mystery-mansion': dynamic(() => import('@/components/gameRoomV2/mysteryMansion/MysteryMansionGame').then((m) => m.MysteryMansionGame), {
    loading: engineLoading,
  }),
  matching: dynamic(() => import('@/components/gameRoomV2/matching/MatchingGame').then((m) => m.MatchingGame), { loading: engineLoading }),
  memory: dynamic(() => import('@/components/gameRoomV2/memory/MemoryGame').then((m) => m.MemoryGame), { loading: engineLoading }),
}

const GameSessionRuntime = dynamic(() => import('@/components/gameRoomV2/gameplay/GameSessionRuntime').then((m) => m.GameSessionRuntime), {
  loading: engineLoading,
})

export function PlaySessionClient({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [engineId, setEngineId] = useState<string | null>(null)
  const [questionSetId, setQuestionSetId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/gameroom-v2/sessions/${sessionId}/state`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setEngineId(data?.engineId ?? '')
        setQuestionSetId(typeof data?.questionSetId === 'string' ? data.questionSetId : null)
      })
      .catch(() => {
        if (!cancelled) setEngineId('')
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (engineId === null) return <GameV2Loading label={ta('loadingGame', true)} />

  // Leaving a game (finished or not) goes to the results page: saved
  // score, XP, topic/board progress and Recommended Next.
  const goToResults = () => router.push(`/gameroom-v2/results/${sessionId}`)
  // "Play again" starts a fresh session on the same set + engine through
  // the normal, server-validated start route.
  const playAgain = async () => {
    if (!questionSetId || !engineId) return goToResults()
    const res = await fetch('/api/gameroom-v2/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionSetId, engineId }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (res?.ok && data.sessionId) router.push(`/gameroom-v2/play/${data.sessionId}`)
    else goToResults()
  }
  const Engine = ENGINE_COMPONENTS[engineId]

  if (Engine) {
    return <Engine sessionId={sessionId} onExit={goToResults} onPlayAgain={playAgain} onHome={() => router.push('/gameroom-v2')} />
  }

  return <GameSessionRuntime sessionId={sessionId} onExit={goToResults} onPlayAgain={playAgain} />
}
