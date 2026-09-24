'use client'

import { useEffect, useState } from 'react'
import { GameV2Card } from '@/components/gameRoomV2'
import { CoopArena, type LiveCoopBattleView } from '@/components/gameRoomV2/bossBattle/CoopArena'

const POLL_INTERVAL_MS = 1500

// The host's own live boss battle view -- polls the SAME
// /api/gameroom-v2/live/[id]/boss-battle endpoint every student's own
// BossBattleGame polls, so the teacher's overview is guaranteed to
// show the identical server-authoritative boss HP and class
// contributions students see, never a separately-derived
// approximation. No `myParticipantId` -- from the teacher's seat no
// attacker is "you", so the "Your Contribution" panel simply doesn't
// render (CoopArena.tsx already handles a null viewer).
export function BossBattleOverview({ liveSessionId }: { liveSessionId: string }) {
  const [liveBattle, setLiveBattle] = useState<LiveCoopBattleView | null>(null)
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(`/api/gameroom-v2/live/${liveSessionId}/boss-battle`)
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (res.ok && data) {
          setLiveBattle(data)
          setStale(false)
        } else {
          setStale(true)
        }
      } catch {
        if (!cancelled) setStale(true)
      }
    }
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [liveSessionId])

  if (!liveBattle) return null

  return (
    <GameV2Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-gamev2ink-900 dark:text-white">Live Battle</h2>
        {stale && (
          <span className="text-[11px] font-bold text-gamev2coral-500 dark:text-gamev2coral-400">
            Having trouble refreshing -- showing last known state
          </span>
        )}
      </div>
      <CoopArena battle={liveBattle} myParticipantId={null} lastHitBoss={false} />
    </GameV2Card>
  )
}
