'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiUsers } from 'react-icons/fi'
import { GameV2Card, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { GameSessionRuntime } from '@/components/gameRoomV2/gameplay'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { subscribeToLiveSession } from '@/lib/gameRoomV2/liveClassroom/realtime'

const HEARTBEAT_INTERVAL_MS = 8000

interface RosterEntry {
  nickname: string
  connected: boolean
}

interface LiveStateResponse {
  status: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED'
  engineId: string
  sessionId: string | null
  roster: RosterEntry[]
}

// The student's Live Classroom experience end-to-end: waiting room
// (Realtime-updated roster, "teacher starts game" transition) then,
// once the host starts the game, mounts the EXACT SAME
// GameSessionRuntime a solo student uses -- Live Classroom's only job
// was getting this participant's own sms_gamev2_sessions row created;
// from here on, gameplay/answering/scoring/rewards are 100% the
// existing, unmodified solo stack. Only classic-quiz is wired up this
// pass (per the explicit "prove infrastructure with a simple game mode
// first" instruction), so this always mounts GameSessionRuntime
// directly rather than branching by engineId the way the solo play
// route does for its custom-visual engines.
export function LivePlayClient({ liveSessionId }: { liveSessionId: string }) {
  const router = useRouter()
  const [state, setState] = useState<LiveStateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = useSupabaseBrowserClient()
  const leftRef = useRef(false)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/gameroom-v2/live/${liveSessionId}/state`)
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      setError(data?.error || 'Failed to load live session')
      return
    }
    setError(null)
    setState(data)
  }, [liveSessionId])

  useEffect(() => {
    refresh()
    const channel = subscribeToLiveSession(supabase, liveSessionId, refresh)
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, liveSessionId, refresh])

  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`/api/gameroom-v2/live/${liveSessionId}/heartbeat`, { method: 'POST' }).catch(() => {})
    }, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [liveSessionId])

  useEffect(() => {
    function sendLeave() {
      if (leftRef.current) return
      leftRef.current = true
      navigator.sendBeacon?.(`/api/gameroom-v2/live/${liveSessionId}/leave`)
    }
    window.addEventListener('beforeunload', sendLeave)
    return () => {
      window.removeEventListener('beforeunload', sendLeave)
    }
  }, [liveSessionId])

  function handleExit() {
    fetch(`/api/gameroom-v2/live/${liveSessionId}/leave`, { method: 'POST' }).catch(() => {})
    router.push('/gameroom-v2/home')
  }

  if (error && !state) return <GameV2Error description={error} onRetry={refresh} />
  if (!state) return <GameV2Loading label="Joining the live session..." />

  if (state.status === 'ENDED') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <GameV2Card padding="lg" className="max-w-sm w-full text-center">
          <h2 className="text-xl font-extrabold text-gamev2ink-900 dark:text-white">The live session has ended</h2>
          <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-2">Thanks for playing!</p>
        </GameV2Card>
      </div>
    )
  }

  if (state.status === 'ACTIVE' && state.sessionId) {
    return <GameSessionRuntime sessionId={state.sessionId} onExit={handleExit} />
  }

  // LOBBY (or ACTIVE-but-not-yet-linked-to-a-session, e.g. this student
  // connected after start already ran and never got a bridge row) --
  // the waiting room.
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <GameV2Card padding="lg" className="max-w-md w-full text-center">
        <div className="text-5xl mb-2" aria-hidden>
          {'⏳'}
        </div>
        <h2 className="text-xl font-extrabold text-gamev2ink-900 dark:text-white">
          {state.status === 'PAUSED' ? 'Game Paused' : 'Waiting for your teacher to start...'}
        </h2>
        <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-1 flex items-center justify-center gap-1.5">
          <FiUsers className="w-4 h-4" /> {state.roster.filter((r) => r.connected).length} student{state.roster.length === 1 ? '' : 's'} here
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {state.roster.map((r, i) => (
            <li
              key={i}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                r.connected
                  ? 'bg-gamev2mint-100 dark:bg-gamev2mint-500/20 text-gamev2mint-700 dark:text-gamev2mint-300'
                  : 'bg-gamev2ink-100 dark:bg-gamev2ink-800 text-gamev2ink-400'
              }`}
            >
              {r.nickname}
            </li>
          ))}
        </ul>
        <button onClick={handleExit} className="mt-6 text-sm font-bold text-gamev2ink-400 hover:text-gamev2coral-500">
          Leave
        </button>
      </GameV2Card>
    </div>
  )
}
