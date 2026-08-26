'use client'

import { useEffect, useState } from 'react'
import { PlayGameClient } from './PlayGameClient'
import { InteractivePlayClient } from './InteractivePlayClient'

// Branches between the quiz engine's PlayGameClient and the new
// interactive (drag-order/memory-match) games. There's no server-side
// "game_kind" fetch here on purpose -- an interactive game's
// sessionStorage entry (set by GameRoomStudentClient.tsx right after
// /interactive/start) is itself the signal: only interactive games ever
// populate it, so its presence IS the routing decision, avoiding an
// extra network round-trip just to ask "which kind of session is this."
export function SessionRouter({ sessionId }: { sessionId: string }) {
  const [interactiveGameType, setInteractiveGameType] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    const raw = sessionStorage.getItem(`gameRoom:${sessionId}:gameData`)
    const gameType = sessionStorage.getItem(`gameRoom:${sessionId}:gameType`)
    setInteractiveGameType(raw && gameType ? gameType : null)
  }, [sessionId])

  if (interactiveGameType === undefined) {
    return null
  }

  if (interactiveGameType) {
    return <InteractivePlayClient sessionId={sessionId} gameType={interactiveGameType} />
  }

  return <PlayGameClient sessionId={sessionId} />
}
