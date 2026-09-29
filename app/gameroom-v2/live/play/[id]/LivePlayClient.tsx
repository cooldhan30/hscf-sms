'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { FiUsers, FiLogOut, FiCheckCircle } from 'react-icons/fi'
import { GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { engineIcon } from '@/components/gameRoomV2/shell/ui'
import { Bi } from '@/components/gameRoomV2/Bi'
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
type EngineProps = { sessionId: string; onExit: () => void; onHome?: () => void }
// Every other active game mounts its OWN real play component on the
// session the shared live system created for this student -- the same
// component solo play uses, so the gameplay is identical and grading,
// progression and rewards stay on the shared server routes.
const LIVE_ENGINES: Record<string, React.ComponentType<EngineProps>> = {
  'boss-battle': dynamic(() => import('@/components/gameRoomV2/bossBattle/brawl/BrawlGame').then((m) => m.BrawlGame), { loading: engineLoading }),
  'tower-defense': dynamic(() => import('@/components/gameRoomV2/towerDefense/TowerDefenseGame').then((m) => m.TowerDefenseGame), { loading: engineLoading }),
  'word-ninja': dynamic(() => import('@/components/gameRoomV2/wordNinja/WordNinjaGame').then((m) => m.WordNinjaGame), { loading: engineLoading }),
  matching: dynamic(() => import('@/components/gameRoomV2/matching/MatchingGame').then((m) => m.MatchingGame), { loading: engineLoading }),
  memory: dynamic(() => import('@/components/gameRoomV2/memory/MemoryGame').then((m) => m.MemoryGame), { loading: engineLoading }),
  'balloon-pop': dynamic(() => import('@/components/gameRoomV2/balloonPop/BalloonPopGame').then((m) => m.BalloonPopGame), {
    loading: engineLoading,
  }),
}

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
  engineName: string
  engineTamilName: string | null
  className: string | null
  questionSetTitle: string | null
  teacherName: string | null
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
// existing, unmodified solo stack, engine-for-engine. All seven active
// games are wired up: Racing is special-cased (real classmates race each
// other through its server-polled multiplayer view -- never simulated
// classmates); Tower Defense, Boss Battle (the real-time arena), Word
// Ninja, Matching and Memory mount their own play component from
// LIVE_ENGINES; Classic Quiz is the GameSessionRuntime fallback.
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
  if (!state) return <GameV2Loading label="நேரலை அமர்வில் சேர்கிறது... · Joining the live session..." />

  if (state.status === 'ENDED') {
    return (
      <LiveCard>
        <FiCheckCircle className="mx-auto w-10 h-10 text-primary-700" aria-hidden />
        <h2 className="mt-2 text-xl font-bold text-primary-900 dark:text-white">
          <Bi k="sessionEnded" />
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          <Bi k="thanksForPlaying" inline />
        </p>
        <button type="button" onClick={handleExit} className="mt-5 min-h-[44px] px-5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold">
          <Bi k="backToGameRoom" inline />
        </button>
      </LiveCard>
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
    const Engine = LIVE_ENGINES[state.engineId]
    if (Engine) return <Engine sessionId={state.sessionId} onExit={handleExit} onHome={handleExit} />
    return <GameSessionRuntime sessionId={state.sessionId} onExit={handleExit} />
  }

  // HOST DISCONNECT / STALE ROOM: a student still waiting in the lobby
  // (never got a sessionId) whose host abandoned the room hours ago --
  // shown only in the waiting room, never interrupting a student who
  // already has an active sessionId and is genuinely mid-game.
  if (state.stale) {
    return (
      <LiveCard>
        <h2 className="text-xl font-bold text-primary-900 dark:text-white font-tamil">இந்த அமர்வு இனி செயலில் இல்லை</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
          <span className="font-tamil">உங்கள் ஆசிரியரிடம் புதிய அமர்வைத் தொடங்கச் சொல்லுங்கள்.</span> This session has gone stale -- ask your teacher to host a new one.
        </p>
        <button type="button" onClick={handleExit} className="mt-4 min-h-[44px] px-5 rounded-xl border border-stone-300 font-semibold text-stone-700 dark:text-stone-200">
          <Bi k="leave" inline />
        </button>
      </LiveCard>
    )
  }

  // LOBBY, or ACTIVE/PAUSED-but-not-yet-linked-to-a-session (this
  // student's /join call is still in flight, or briefly raced the
  // host's own start/late-join bridge -- the next Realtime update or
  // /state poll will pick up sessionId once it lands) -- the waiting
  // room.
  const EngineIcon = engineIcon(state.engineId)
  const here = state.roster.filter((r) => r.connected).length
  return (
    <LiveCard wide>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-terracotta-600">
        <span className="font-tamil normal-case tracking-normal text-sm">நேரலை வகுப்பு</span> · Live classroom
      </p>
      <div className="mt-3 flex items-center justify-center gap-3">
        <span className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 flex items-center justify-center" aria-hidden>
          <EngineIcon className="w-7 h-7" />
        </span>
        <div className="text-left">
          <p className="text-xl font-bold text-primary-900 dark:text-white font-tamil leading-tight">{state.engineTamilName ?? state.engineName}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">{state.engineName}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-left">
        {[
          { k: 'teacher' as const, v: state.teacherName },
          { k: 'class' as const, v: state.className },
          { k: 'questionSet' as const, v: state.questionSetTitle },
        ].map((row) => (
          <div key={row.k} className="rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 px-3 py-2">
            <dt className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
              <Bi k={row.k} inline />
            </dt>
            <dd className="font-semibold text-stone-800 dark:text-stone-100 truncate font-tamil">{row.v ?? '—'}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 rounded-2xl border-2 border-dashed border-primary-200 dark:border-primary-800 px-4 py-4" role="status" aria-live="polite">
        <p className="text-lg font-bold text-primary-800 dark:text-primary-200">
          {state.status === 'PAUSED' ? <Bi k="paused" /> : <Bi k="waitingForTeacher" />}
        </p>
        <span className="mt-2 inline-flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-stone-600 dark:text-stone-300 flex items-center justify-center gap-1.5">
        <FiUsers className="w-4 h-4" aria-hidden /> <Bi k="studentsJoined" inline />: {here}
      </p>
      <ul className="mt-2 flex flex-wrap justify-center gap-2">
        {state.roster.map((r, i) => (
          <li
            key={i}
            className={`px-3 py-1.5 rounded-full text-xs font-bold ${r.connected ? 'bg-primary-50 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'bg-stone-100 text-stone-400 dark:bg-stone-800'}`}
          >
            {r.nickname}
          </li>
        ))}
      </ul>
      <button type="button" onClick={handleExit} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-terracotta-600 min-h-[44px]">
        <FiLogOut className="w-4 h-4" aria-hidden /> <Bi k="leave" inline />
      </button>
    </LiveCard>
  )
}

function LiveCard({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
      <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-sm'} text-center bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm`}>{children}</div>
    </div>
  )
}
