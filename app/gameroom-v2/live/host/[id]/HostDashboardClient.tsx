'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { FiUsers, FiCopy, FiPlay, FiPause, FiSquare, FiCheckCircle, FiCircle } from 'react-icons/fi'
import { engineIcon } from '@/components/gameRoomV2/shell/ui'
import { GameV2Loading, GameV2Error, GameV2ConfirmDialog } from '@/components/gameRoomV2'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { subscribeToLiveSession } from '@/lib/gameRoomV2/liveClassroom/realtime'
import { createCoalescer } from '@/lib/gameRoomV2/gameplay/coalesce'
import { toast } from '@/lib/toast'

// Engine-specific overviews are code-split: a teacher hosting a Classic
// Quiz never downloads the race track or boss arena, and a Racing host
// never downloads Boss Battle's.
const RaceTrackOverview = dynamic(() => import('./RaceTrackOverview').then((m) => m.RaceTrackOverview))
const BossBattleOverview = dynamic(() => import('./BossBattleOverview').then((m) => m.BossBattleOverview))

// Every participant heartbeat is a Realtime event; refetch the lobby at
// most once per window (see lib/gameRoomV2/gameplay/coalesce.ts).
const REFRESH_COALESCE_MS = 1000
const RESULTS_POLL_MS = 3000

interface LobbyParticipant {
  id: string
  nickname: string
  connected: boolean
  hasStarted: boolean
}

interface RosterStudent {
  studentId: string
  name: string
  joined: boolean
  connected: boolean
  playing: boolean
}

interface LobbyState {
  status: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED'
  joinCode: string
  engineId: string
  engineName: string
  className: string | null
  questionSetTitle: string | null
  questionCount: number | null
  stale: boolean
  roster: RosterStudent[]
  participants: LobbyParticipant[]
}

interface ResultRow {
  participantId: string
  nickname: string
  status: string
  score: number
  correctCount: number
  answeredCount: number
  bestStreak: number
}

// The teacher's Live Classroom control room: join code, live roster
// (via Realtime -- see subscribeToLiveSession), and Start/Pause/Resume/
// End. Once ACTIVE, also shows a live results/leaderboard view built
// from every participant's own (unmodified) solo session row.
export function HostDashboardClient({ liveSessionId }: { liveSessionId: string }) {
  const [lobby, setLobby] = useState<LobbyState | null>(null)
  const [results, setResults] = useState<ResultRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actionInFlight, setActionInFlight] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const supabase = useSupabaseBrowserClient()
  const lastLobbyRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/gameroom-v2/live/${liveSessionId}/lobby`)
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      setError(data?.error || 'Failed to load lobby')
      return
    }
    setError(null)
    // A heartbeat-triggered refetch usually returns the identical lobby;
    // skip the re-render of the whole dashboard (and its live track).
    const serialized = JSON.stringify(data)
    if (serialized === lastLobbyRef.current) return
    lastLobbyRef.current = serialized
    setLobby(data)
  }, [liveSessionId])

  const refreshResults = useCallback(async () => {
    const res = await fetch(`/api/gameroom-v2/live/${liveSessionId}/results`)
    const data = await res.json().catch(() => null)
    if (res.ok && data) setResults(data.results)
  }, [liveSessionId])

  const coalescedRefresh = useMemo(() => createCoalescer(() => void refresh(), REFRESH_COALESCE_MS), [refresh])

  useEffect(() => {
    refresh()
    const channel = subscribeToLiveSession(supabase, liveSessionId, coalescedRefresh.call)
    return () => {
      coalescedRefresh.cancel()
      supabase.removeChannel(channel)
    }
  }, [supabase, liveSessionId, refresh, coalescedRefresh])

  // Live leaderboard: polled while ACTIVE; fetched ONCE when the session
  // ends (final standings never change after ENDED -- this used to keep
  // polling every 3s for as long as the tab stayed open).
  useEffect(() => {
    const status = lobby?.status
    if (status === 'ENDED') {
      refreshResults()
      return
    }
    if (status !== 'ACTIVE') return
    refreshResults()
    const interval = setInterval(refreshResults, RESULTS_POLL_MS)
    return () => clearInterval(interval)
  }, [lobby?.status, refreshResults])

  async function handleAction(endpoint: 'start' | 'pause' | 'resume' | 'end') {
    setActionInFlight(true)
    const res = await fetch(`/api/gameroom-v2/live/${liveSessionId}/${endpoint}`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setActionInFlight(false)
    if (!res.ok) {
      toast.error(data.error || `Failed to ${endpoint}`)
      return
    }
    refresh()
  }

  async function handleConfirmEnd() {
    setConfirmEndOpen(false)
    await handleAction('end')
  }

  function copyJoinCode() {
    if (!lobby) return
    navigator.clipboard.writeText(lobby.joinCode).then(
      () => toast.success('Join code copied'),
      () => {}
    )
  }

  if (error && !lobby) return <GameV2Error description={error} onRetry={refresh} />
  if (!lobby) return <GameV2Loading label="Setting up your live session..." />

  const connectedCount = lobby.participants.filter((p) => p.connected).length
  const joinedCount = lobby.roster.filter((r) => r.joined).length
  // Grouped in fours so it can be read aloud and copied from across a room.
  const grouped = lobby.joinCode.replace(/(.{4})(?=.)/g, '$1 ')
  const EngineIcon = engineIcon(lobby.engineId)
  const guests = lobby.participants.length - joinedCount

  return (
    <div className="space-y-5">
      {lobby.stale && lobby.status !== 'ENDED' && (
        <div className="rounded-2xl border border-red-300 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300">
          This session has been open a long time and may be stale. If you&apos;re not using it, end it.
        </div>
      )}

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600 dark:text-stone-300">
          <span className="inline-flex items-center gap-1.5 font-semibold text-primary-900 dark:text-white">
            <EngineIcon className="w-4 h-4 text-primary-700" aria-hidden /> {lobby.engineName}
          </span>
          {lobby.className && <span>Class: <span className="font-semibold">{lobby.className}</span></span>}
          {lobby.questionSetTitle && (
            <span>
              Set: <span className="font-semibold font-tamil">{lobby.questionSetTitle}</span>
              {lobby.questionCount ? ` · ${lobby.questionCount} questions` : ''}
            </span>
          )}
        </div>

        {lobby.status !== 'ENDED' && (
          <div className="mt-5 text-center">
            <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">
              Students go to <span className="font-bold text-stone-700 dark:text-stone-200">Game Room</span> and type this code at the top
            </p>
            <button type="button" onClick={copyJoinCode} className="mt-2 inline-flex items-center gap-3 group rounded-2xl px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-950 focus:outline-none focus:ring-4 focus:ring-primary-300" aria-label={`Join code ${lobby.joinCode}. Click to copy.`}>
              <span className="font-mono text-6xl sm:text-7xl font-black tracking-[0.12em] text-primary-900 dark:text-white tabular-nums">{grouped}</span>
              <FiCopy className="w-6 h-6 text-stone-300 group-hover:text-primary-500" aria-hidden />
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
          {lobby.status === 'LOBBY' && (
            <button
              type="button"
              disabled={actionInFlight || connectedCount === 0}
              onClick={() => handleAction('start')}
              className="w-full sm:w-auto min-h-[56px] px-8 rounded-xl bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white text-lg font-bold inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-primary-300"
            >
              <FiPlay className="w-5 h-5" aria-hidden /> Start game{connectedCount > 0 ? ` (${connectedCount})` : ''}
            </button>
          )}
          {lobby.status === 'ACTIVE' && (
            <button type="button" disabled={actionInFlight} onClick={() => handleAction('pause')} className="min-h-[48px] px-5 rounded-xl border border-stone-300 dark:border-stone-700 font-semibold text-stone-700 dark:text-stone-200 inline-flex items-center gap-2">
              <FiPause className="w-4 h-4" aria-hidden /> Pause
            </button>
          )}
          {lobby.status === 'PAUSED' && (
            <button type="button" disabled={actionInFlight} onClick={() => handleAction('resume')} className="min-h-[48px] px-5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold inline-flex items-center gap-2">
              <FiPlay className="w-4 h-4" aria-hidden /> Resume
            </button>
          )}
          {lobby.status !== 'ENDED' && (
            <button type="button" disabled={actionInFlight} onClick={() => setConfirmEndOpen(true)} className="min-h-[48px] px-5 rounded-xl border border-red-300 text-red-700 dark:text-red-300 font-semibold inline-flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/30">
              <FiSquare className="w-4 h-4" aria-hidden /> End game
            </button>
          )}
        </div>
        {lobby.status === 'LOBBY' && connectedCount === 0 && <p className="mt-2 text-center text-sm text-stone-500">Start unlocks as soon as a student joins.</p>}
        {lobby.status === 'ACTIVE' && <p className="mt-2 text-center text-sm font-semibold text-primary-700">Live now -- late joiners go straight into the game.</p>}
        {lobby.status === 'PAUSED' && <p className="mt-2 text-center text-sm font-semibold text-gold-700">Paused for everyone.</p>}
        {lobby.status === 'ENDED' && <p className="mt-2 text-center text-lg font-bold text-stone-700 dark:text-stone-200">This live game has ended.</p>}
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold text-primary-900 dark:text-white flex items-center gap-2">
            <FiUsers className="w-5 h-5" aria-hidden /> Students
          </h2>
          <p className="text-sm font-semibold text-stone-600 dark:text-stone-300 tabular-nums">
            {joinedCount} of {lobby.roster.length} joined
          </p>
        </div>
        {lobby.roster.length === 0 ? (
          <p className="text-sm text-stone-500">No students are enrolled in this class yet.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {lobby.roster.map((r) => (
              <li key={r.studentId} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${r.joined ? 'bg-primary-50 dark:bg-primary-950/40' : 'bg-stone-50 dark:bg-stone-800/40'}`}>
                {r.joined ? <FiCheckCircle className="w-4 h-4 text-primary-700 shrink-0" aria-hidden /> : <FiCircle className="w-4 h-4 text-stone-300 shrink-0" aria-hidden />}
                <span className={`text-sm font-semibold truncate ${r.joined ? 'text-stone-800 dark:text-stone-100' : 'text-stone-400'}`}>{r.name}</span>
                <span className="ml-auto text-[11px] font-semibold text-stone-500 shrink-0">
                  {!r.joined ? 'Not joined' : !r.connected ? 'Away' : r.playing ? 'Playing' : 'Ready'}
                </span>
                <span className="sr-only">{r.joined ? 'joined' : 'not joined'}</span>
              </li>
            ))}
          </ul>
        )}
        {guests > 0 && <p className="mt-2 text-xs text-stone-500">{guests} more joined who are no longer on this class list.</p>}
      </div>

      {lobby.status !== 'LOBBY' && results.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-primary-900 dark:text-white mb-3">Progress</h2>
          <ul className="space-y-1.5">
            {results.map((r, i) => (
              <li key={r.participantId} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 px-3 py-2">
                <span className="font-semibold text-sm text-stone-800 dark:text-stone-100 truncate">
                  {i + 1}. {r.nickname}
                </span>
                <span className="text-sm font-semibold text-primary-700 dark:text-primary-400 tabular-nums shrink-0">
                  {r.correctCount}/{r.answeredCount} correct · {r.score} pts
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Racing's own track overview -- the score list above already
          covers every engine generically, but for a race specifically
          the teacher benefits from seeing the actual track (who's
          ahead visually), not just a score table. Polls the same
          server-authoritative /race endpoint every racer's own screen
          uses -- the teacher sees exactly what students see, never a
          separately-computed view that could disagree with it. */}
      {lobby.engineId === 'racing' && (lobby.status === 'ACTIVE' || lobby.status === 'PAUSED') && (
        <RaceTrackOverview liveSessionId={liveSessionId} />
      )}

      {/* Boss Battle's own cooperative overview -- boss HP, class
          progress, and the class contribution leaderboard, polling the
          same server-authoritative /boss-battle endpoint every
          student's own screen uses. */}
      {lobby.engineId === 'boss-battle' && (lobby.status === 'ACTIVE' || lobby.status === 'PAUSED') && (
        <BossBattleOverview liveSessionId={liveSessionId} />
      )}

      <GameV2ConfirmDialog
        open={confirmEndOpen}
        onClose={() => setConfirmEndOpen(false)}
        onConfirm={handleConfirmEnd}
        title="End this session?"
        confirmLabel="End Session"
        confirming={actionInFlight}
        message={
          lobby.status === 'LOBBY' ? (
            <p>This closes the lobby before anyone has started playing. The join code will stop working.</p>
          ) : (
            <>
              <p>
                {connectedCount > 0
                  ? `${connectedCount} student${connectedCount === 1 ? ' is' : 's are'} currently connected. Ending now will stop the game for everyone immediately.`
                  : 'This will stop the game for everyone.'}
              </p>
              <p className="mt-2">Anyone still mid-game keeps their progress and score so far, but this cannot be undone or resumed.</p>
            </>
          )
        }
      />
    </div>
  )
}
