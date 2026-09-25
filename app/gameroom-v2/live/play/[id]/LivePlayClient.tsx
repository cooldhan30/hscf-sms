'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { FiUsers } from 'react-icons/fi'
import { GameV2Card, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { subscribeToLiveSession } from '@/lib/gameRoomV2/liveClassroom/realtime'
import { shouldRenderGameplay } from '@/lib/gameRoomV2/liveClassroom/lifecycle'
import { createCoalescer } from '@/lib/gameRoomV2/gameplay/coalesce'

// Engines are code-split: a student waiting in the lobby downloads none
// of them, and a student in a Racing session never downloads Boss
// Battle (or vice versa).
const engineLoading = () => <GameV2Loading label="Loading game..." />
const GameSessionRuntime = dynamic(() => import('@/components/gameRoomV2/gameplay/GameSessionRuntime').then((m) => m.GameSessionRuntime), {
  loading: engineLoading,
})
const RacingGame = dynamic(() => import('@/components/gameRoomV2/racing/RacingGame').then((m) => m.RacingGame), { loading: engineLoading })
const BossBattleGame = dynamic(() => import('@/components/gameRoomV2/bossBattle/BossBattleGame').then((m) => m.BossBattleGame), {
  loading: engineLoading,
})

const HEARTBEAT_INTERVAL_MS = 8000
// At most one /state refetch per window per client, however many
// Realtime events arrive (see lib/gameRoomV2/gameplay/coalesce.ts).
const REFRESH_COALESCE_MS = 1000

interface RosterEntry {
  nickname: string
  connected: boolean
}

interface LiveStateResponse {
  status: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED'
  engineId: string
  sessionId: string | null
  participantId: string
  raceDifficulty: 'easy' | 'normal' | 'hard'
  bossId: 'suran' | 'kotravai-guardian' | 'naga-serpent' | null
  bossDifficulty: 'easy' | 'normal' | 'hard'
  stale: boolean
  roster: RosterEntry[]
}

// The student's Live Classroom experience end-to-end: waiting room
// (Realtime-updated roster, "teacher starts game" transition) then,
// once the host starts the game, mounts the SAME per-engine play
// component solo play uses (PlaySessionClient's own
// engineId-branching precedent) -- Live Classroom's only job was
// getting this participant's own sms_gamev2_sessions row created;
// from here on, gameplay/answering/scoring/rewards are 100% the
// existing, unmodified solo stack, engine-for-engine. Only
// classic-quiz/racing/boss-battle are wired up here -- these are the 3
// engines that actually declare (and, as of this pass, genuinely
// implement) liveClassroomSupport: true in the registry; every other
// engine's registry entry keeps that flag false specifically because
// no branch exists for it here.
//
// Racing and Boss Battle are BOTH special-cased directly below (not
// through a generic id-to-component map) because they're the two
// engines with genuine multiplayer support -- each needs extra
// liveSessionId/participantId/fixed-config props no other engine
// takes, since both branch internally into a server-polled
// multiplayer view instead of their solo local-tick loop. Every other
// liveClassroomSupport engine (today, only classic-quiz) falls through
// to the plain GameSessionRuntime fallback.
export function LivePlayClient({ liveSessionId }: { liveSessionId: string }) {
  const router = useRouter()
  const [state, setState] = useState<LiveStateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = useSupabaseBrowserClient()
  const leftRef = useRef(false)
  const lastPayloadRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/gameroom-v2/live/${liveSessionId}/state`)
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      setError(data?.error || 'Failed to load live session')
      return
    }
    setError(null)
    // Most refetches return an identical payload (a heartbeat changed
    // last_seen_at, not anything shown). Skipping the setState avoids
    // re-rendering the whole mounted game tree for nothing.
    const serialized = JSON.stringify(data)
    if (serialized === lastPayloadRef.current) return
    lastPayloadRef.current = serialized
    setState(data)
  }, [liveSessionId])

  const coalescedRefresh = useMemo(() => createCoalescer(() => void refresh(), REFRESH_COALESCE_MS), [refresh])
  useEffect(() => () => coalescedRefresh.cancel(), [coalescedRefresh])

  // Once gameplay is on screen the roster isn't shown, so only the
  // session row (PAUSED/ENDED) still matters -- stop receiving every
  // classmate's heartbeat.
  const inGameplay = state ? shouldRenderGameplay(state.status, state.sessionId !== null) && Boolean(state.sessionId) : false

  useEffect(() => {
    refresh()
    const channel = subscribeToLiveSession(supabase, liveSessionId, coalescedRefresh.call, { includeParticipants: !inGameplay })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, liveSessionId, refresh, coalescedRefresh, inGameplay])

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
    router.push('/gameroom-v2')
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

  if (shouldRenderGameplay(state.status, state.sessionId !== null) && state.sessionId) {
    if (state.engineId === 'racing') {
      return (
        <RacingGame
          sessionId={state.sessionId}
          onExit={handleExit}
          liveSessionId={liveSessionId}
          myParticipantId={state.participantId}
          fixedDifficulty={state.raceDifficulty}
        />
      )
    }
    if (state.engineId === 'boss-battle') {
      return (
        <BossBattleGame
          sessionId={state.sessionId}
          onExit={handleExit}
          liveSessionId={liveSessionId}
          myParticipantId={state.participantId}
          fixedBossId={state.bossId ?? undefined}
          fixedDifficulty={state.bossDifficulty}
        />
      )
    }
    return <GameSessionRuntime sessionId={state.sessionId} onExit={handleExit} />
  }

  // HOST DISCONNECT / STALE ROOM: a student still waiting in the lobby
  // (never got a sessionId) whose host abandoned the room hours ago --
  // shown only in the waiting room, never interrupting a student who
  // already has an active sessionId and is genuinely mid-game.
  if (state.stale) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <GameV2Card padding="lg" className="max-w-sm w-full text-center">
          <h2 className="text-xl font-extrabold text-gamev2ink-900 dark:text-white">This session has gone stale</h2>
          <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-2">Your teacher may have closed this session. Ask them to host a new one.</p>
          <button onClick={handleExit} className="mt-4 text-sm font-bold text-gamev2ink-400 hover:text-gamev2coral-500">
            Leave
          </button>
        </GameV2Card>
      </div>
    )
  }

  // LOBBY, or ACTIVE/PAUSED-but-not-yet-linked-to-a-session (this
  // student's /join call is still in flight, or briefly raced the
  // host's own start/late-join bridge -- the next Realtime update or
  // /state poll will pick up sessionId once it lands) -- the waiting
  // room.
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
