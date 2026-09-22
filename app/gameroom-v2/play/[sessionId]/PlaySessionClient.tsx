'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GameSessionRuntime } from '@/components/gameRoomV2/gameplay'
import { TowerDefenseGame } from '@/components/gameRoomV2/towerDefense'
import { RacingGame } from '@/components/gameRoomV2/racing'
import { BossBattleGame } from '@/components/gameRoomV2/bossBattle'
import { GameV2Loading } from '@/components/gameRoomV2'

// Most engines have no visual layer of their own and mount
// GameSessionRuntime directly (the "thin reference engine" path). Tower
// Defense, Racing, and Boss Battle each want a different visual frame
// around the question -- a battlefield, race track, or arena instead of
// a plain centered card -- so this is the one branch point: a single
// lightweight /state call reveals which engine owns the session, then
// the right top-level component takes over. Every future engine that
// needs its own board gets a case here the same way.
export function PlaySessionClient({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [engineId, setEngineId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/gameroom-v2/sessions/${sessionId}/state`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setEngineId(data?.engineId ?? '')
      })
      .catch(() => {
        if (!cancelled) setEngineId('')
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (engineId === null) return <GameV2Loading label="Loading game..." />

  if (engineId === 'tower-defense') {
    return (
      <TowerDefenseGame
        sessionId={sessionId}
        onExit={() => router.push('/gameroom-v2/library')}
        onPlayAgain={() => router.push('/gameroom-v2/library')}
      />
    )
  }

  if (engineId === 'racing') {
    return (
      <RacingGame
        sessionId={sessionId}
        onExit={() => router.push('/gameroom-v2/library')}
        onPlayAgain={() => router.push('/gameroom-v2/library')}
      />
    )
  }

  if (engineId === 'boss-battle') {
    return (
      <BossBattleGame
        sessionId={sessionId}
        onExit={() => router.push('/gameroom-v2/library')}
        onPlayAgain={() => router.push('/gameroom-v2/library')}
      />
    )
  }

  return (
    <GameSessionRuntime
      sessionId={sessionId}
      onExit={() => router.push('/gameroom-v2/library')}
    />
  )
}
