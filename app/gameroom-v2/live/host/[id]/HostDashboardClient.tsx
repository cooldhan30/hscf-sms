'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { FiUsers, FiCopy, FiPlay, FiPause, FiSquare } from 'react-icons/fi'
import { GameV2Card, GameV2Button, GameV2Loading, GameV2Error, GameV2ConfirmDialog } from '@/components/gameRoomV2'
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

interface LobbyState {
  status: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED'
  joinCode: string
  engineId: string
  stale: boolean
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

  return (
    <div className="space-y-6">
      {lobby.stale && lobby.status !== 'ENDED' && (
        <GameV2Card padding="md" className="text-center border-2 border-gamev2coral-300 dark:border-gamev2coral-600">
          <p className="text-sm font-bold text-gamev2coral-600 dark:text-gamev2coral-300">
            This session has been open a long time and may be stale. If you&apos;re not actively using it, consider ending it.
          </p>
        </GameV2Card>
      )}

      <GameV2Card padding="lg" className="text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2">Join Code</p>
        <button onClick={copyJoinCode} className="inline-flex items-center gap-3 group">
          <span className="text-5xl font-black tracking-[0.2em] text-gamev2ink-900 dark:text-white tabular-nums">{lobby.joinCode}</span>
          <FiCopy className="w-5 h-5 text-gamev2ink-300 group-hover:text-gamev2spark-500" />
        </button>
        <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-3 flex items-center justify-center gap-1.5">
          <FiUsers className="w-4 h-4" /> {connectedCount} student{connectedCount === 1 ? '' : 's'} in the lobby
        </p>
      </GameV2Card>

      <GameV2Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-gamev2ink-900 dark:text-white">
            {lobby.status === 'LOBBY' && 'Waiting to Start'}
            {lobby.status === 'ACTIVE' && 'Live'}
            {lobby.status === 'PAUSED' && 'Paused'}
            {lobby.status === 'ENDED' && 'Ended'}
          </h2>
          <div className="flex gap-2">
            {lobby.status === 'LOBBY' && (
              <GameV2Button size="md" variant="spark" disabled={actionInFlight || connectedCount === 0} onClick={() => handleAction('start')}>
                <FiPlay className="w-4 h-4" /> Start
              </GameV2Button>
            )}
            {lobby.status === 'ACTIVE' && (
              <GameV2Button size="md" variant="ghost" disabled={actionInFlight} onClick={() => handleAction('pause')}>
                <FiPause className="w-4 h-4" /> Pause
              </GameV2Button>
            )}
            {lobby.status === 'PAUSED' && (
              <GameV2Button size="md" variant="spark" disabled={actionInFlight} onClick={() => handleAction('resume')}>
                <FiPlay className="w-4 h-4" /> Resume
              </GameV2Button>
            )}
            {(lobby.status === 'ACTIVE' || lobby.status === 'PAUSED' || lobby.status === 'LOBBY') && (
              <GameV2Button size="md" variant="danger" disabled={actionInFlight} onClick={() => setConfirmEndOpen(true)}>
                <FiSquare className="w-4 h-4" /> End
              </GameV2Button>
            )}
          </div>
        </div>

        {lobby.status === 'LOBBY' ? (
          <ul className="space-y-2">
            {lobby.participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-xl bg-gamev2ink-50 dark:bg-gamev2ink-800/50 px-3 py-2">
                <span className="font-bold text-sm text-gamev2ink-800 dark:text-gamev2ink-100">{p.nickname}</span>
                <span className={`text-xs font-bold ${p.connected ? 'text-gamev2mint-600 dark:text-gamev2mint-400' : 'text-gamev2ink-400'}`}>
                  {p.connected ? 'Connected' : 'Disconnected'}
                </span>
              </li>
            ))}
            {lobby.participants.length === 0 && <p className="text-sm text-gamev2ink-400 dark:text-gamev2ink-500 text-center py-4">Share the join code above to get started.</p>}
          </ul>
        ) : (
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={r.participantId} className="flex items-center justify-between rounded-xl bg-gamev2ink-50 dark:bg-gamev2ink-800/50 px-3 py-2">
                <span className="font-bold text-sm text-gamev2ink-800 dark:text-gamev2ink-100">
                  #{i + 1} {r.nickname}
                </span>
                <span className="text-sm font-bold text-gamev2spark-600 dark:text-gamev2spark-400 tabular-nums">
                  {r.score} pts &middot; {r.correctCount}/{r.answeredCount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GameV2Card>

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
