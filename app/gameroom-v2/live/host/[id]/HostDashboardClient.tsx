'use client'

import { useCallback, useEffect, useState } from 'react'
import { FiUsers, FiCopy, FiPlay, FiPause, FiSquare } from 'react-icons/fi'
import { GameV2Card, GameV2Button, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { subscribeToLiveSession } from '@/lib/gameRoomV2/liveClassroom/realtime'
import { toast } from '@/lib/toast'

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
  const supabase = useSupabaseBrowserClient()

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/gameroom-v2/live/${liveSessionId}/lobby`)
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      setError(data?.error || 'Failed to load lobby')
      return
    }
    setError(null)
    setLobby(data)
  }, [liveSessionId])

  const refreshResults = useCallback(async () => {
    const res = await fetch(`/api/gameroom-v2/live/${liveSessionId}/results`)
    const data = await res.json().catch(() => null)
    if (res.ok && data) setResults(data.results)
  }, [liveSessionId])

  useEffect(() => {
    refresh()
    const channel = subscribeToLiveSession(supabase, liveSessionId, refresh)
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, liveSessionId, refresh])

  useEffect(() => {
    if (lobby?.status !== 'ACTIVE' && lobby?.status !== 'ENDED') return
    refreshResults()
    const interval = setInterval(refreshResults, 3000)
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
              <GameV2Button size="md" variant="danger" disabled={actionInFlight} onClick={() => handleAction('end')}>
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
    </div>
  )
}
