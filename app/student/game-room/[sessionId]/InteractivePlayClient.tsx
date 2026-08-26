'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getInteractiveGameModule } from '@/lib/gameRoom/registry'
import { UyirOrderGame } from '@/components/gameRoom/UyirOrderGame'
import { UyirMemoryGame } from '@/components/gameRoom/UyirMemoryGame'
import type { OrderGameData } from '@/lib/gameRoom/modules/uyirEzhuthukkal/orderGame'
import type { MemoryGameData } from '@/lib/gameRoom/modules/uyirEzhuthukkal/memoryGame'

// Board data (shuffled tiles/cards) is generated once by
// /api/game-room/interactive/start and handed straight to the client --
// it is never persisted server-side or re-fetched (see the plan's
// rationale: a solo, non-competitive letter game has no need for the
// quiz engine's poll/re-fetch machinery). GameRoomStudentClient.tsx
// stashes it in sessionStorage right after the start call, keyed by
// sessionId, for this component to read once on mount. A page refresh
// loses this (there is nothing server-side to refetch by design) and
// falls back to the "start again" prompt below.
export function InteractivePlayClient({ sessionId: initialSessionId, gameType }: { sessionId: string; gameType: string }) {
  const router = useRouter()
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [gameData, setGameData] = useState<OrderGameData | MemoryGameData | null | undefined>(undefined)
  // Bumped on every restart so UyirOrderGame/UyirMemoryGame remount with
  // fresh internal state (placed tiles, matched pairs, etc.) instead of
  // reusing a stale instance -- neither game resets its own state if its
  // `tiles` prop changes without a key change.
  const [instanceKey, setInstanceKey] = useState(0)

  useEffect(() => {
    const raw = sessionStorage.getItem(`gameRoom:${sessionId}:gameData`)
    setGameData(raw ? JSON.parse(raw) : null)
  }, [sessionId])

  const gameModule = getInteractiveGameModule(gameType)

  async function handleComplete(sid: string, score: number) {
    await fetch('/api/game-room/interactive/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, score, correctCount: score }),
    })
    sessionStorage.removeItem(`gameRoom:${sid}:gameData`)
  }

  // Replay resets completely without a page refresh (per spec) -- starts
  // a brand-new session+player row (a fresh reshuffled board) rather than
  // reusing the completed one, and swaps the URL to match via
  // router.replace so the address bar/back button stay consistent.
  async function handleRestart() {
    setGameData(undefined)
    const res = await fetch('/api/game-room/interactive/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      setGameData(null)
      return
    }

    sessionStorage.setItem(`gameRoom:${data.sessionId}:gameData`, JSON.stringify(data.gameData))
    sessionStorage.setItem(`gameRoom:${data.sessionId}:gameType`, gameType)
    setSessionId(data.sessionId)
    setGameData(data.gameData)
    setInstanceKey((k) => k + 1)
    router.replace(`/student/game-room/${data.sessionId}`)
  }

  if (gameData === undefined) {
    return <p className="text-center py-16 text-stone-400 dark:text-stone-500">Loading...</p>
  }

  if (!gameData || !gameModule) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-stone-500 dark:text-stone-400">
          This game session has expired -- start a fresh one from Game Room.
        </p>
      </div>
    )
  }

  if (gameType === 'uyir-order') {
    return (
      <UyirOrderGame
        key={instanceKey}
        sessionId={sessionId}
        tiles={(gameData as OrderGameData).tiles}
        instructions={gameModule.instructions}
        onComplete={handleComplete}
        onRestart={handleRestart}
      />
    )
  }

  return (
    <UyirMemoryGame
      key={instanceKey}
      sessionId={sessionId}
      tiles={(gameData as MemoryGameData).tiles}
      instructions={gameModule.instructions}
      onComplete={handleComplete}
      onRestart={handleRestart}
    />
  )
}
