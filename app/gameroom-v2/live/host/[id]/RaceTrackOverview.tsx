'use client'

import { useEffect, useState } from 'react'
import { GameV2Card } from '@/components/gameRoomV2'
import { Track } from '@/components/gameRoomV2/racing'
import { RACE_THEMES, liveRacersToRaceState, type LiveRaceResponse } from '@/lib/gameRoomV2/racing'

const POLL_INTERVAL_MS = 1500

// The host's own live track view -- polls the SAME
// /api/gameroom-v2/live/[id]/race endpoint every student's own
// RacingGame polls, so the teacher's overview is guaranteed to show
// the identical server-authoritative positions students see, never a
// separately-derived approximation. No `myParticipantId` -- from the
// teacher's seat no racer is "you", so every lane renders in the same
// neutral (non-bold) style.
export function RaceTrackOverview({ liveSessionId }: { liveSessionId: string }) {
  const [liveRace, setLiveRace] = useState<LiveRaceResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      const res = await fetch(`/api/gameroom-v2/live/${liveSessionId}/race`)
      const data = await res.json().catch(() => null)
      if (!cancelled && res.ok && data) setLiveRace(data)
    }
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [liveSessionId])

  if (!liveRace || liveRace.racers.length === 0) return null

  return (
    <GameV2Card>
      <h2 className="font-extrabold text-gamev2ink-900 dark:text-white mb-4">Live Track</h2>
      <Track state={liveRacersToRaceState(liveRace, null)} themeId={RACE_THEMES[0].id} live />
    </GameV2Card>
  )
}
