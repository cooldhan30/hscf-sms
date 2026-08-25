'use client'

import { useEffect, useState } from 'react'
import { FiPlay, FiPause, FiSquare, FiUsers } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { subscribeToGameSession } from '@/lib/gameRoom/realtime'
import { toast } from '@/lib/toast'

interface GameOption {
  id: string
  name: string
  description: string
  categories: { id: string; label: string }[]
  questionCount: number
}

interface Player {
  id: string
  nickname: string
  score: number
  current_index: number
  correct_count: number
  answered_count: number
  completed: boolean
}

interface SessionState {
  session: {
    id: string
    join_code: string
    status: 'waiting' | 'active' | 'paused' | 'ended'
    game_type: string
    question_count: number
    question_time_limit_seconds: number
  }
  players: Player[]
  stats: { totalPlayers: number; completedCount: number; playingCount: number; avgScore: number; avgAccuracy: number }
  categoryAccuracy: { category: string; label: string; accuracy: number }[]
}

const COUNT_PRESETS = [10, 20, 30, 60]
const TIME_LIMITS = [10, 15, 20, 30]

export function GameRoomHostClient() {
  const confirm = useConfirm()
  const supabase = useSupabaseBrowserClient()

  const [games, setGames] = useState<GameOption[] | null>(null)
  const [gameType, setGameType] = useState('')
  const [quizMode, setQuizMode] = useState<'full' | 'count' | 'category'>('count')
  const [count, setCount] = useState(20)
  const [category, setCategory] = useState('')
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(20)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [state, setState] = useState<SessionState | null>(null)
  const [loadingState, setLoadingState] = useState(false)

  useEffect(() => {
    fetch('/api/game-room/games')
      .then((res) => res.json())
      .then((data) => {
        setGames(data.games ?? [])
        if (data.games?.[0]) {
          setGameType(data.games[0].id)
          setCategory(data.games[0].categories?.[0]?.id ?? '')
        }
      })
      .catch(() => setGames([]))
  }, [])

  const selectedGame = games?.find((g) => g.id === gameType)

  async function refreshState(sessionId: string) {
    const res = await fetch(`/api/game-room/sessions/${sessionId}`)
    const data = await res.json().catch(() => null)
    if (res.ok && data) setState(data)
  }

  // Realtime subscription drives the live dashboard once a session
  // exists -- re-fetches the full session view on any player/session
  // change rather than trying to reconstruct state from the payload
  // itself, matching this codebase's "Realtime as a refetch trigger"
  // comfort level (see lib/gameRoom/realtime.ts).
  useEffect(() => {
    if (!state?.session.id) return
    const sessionId = state.session.id
    const channel = subscribeToGameSession(supabase, sessionId, () => refreshState(sessionId))
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.session.id])

  // Fallback poll, independent of the Realtime subscription above --
  // Realtime requires the game tables to be correctly registered in the
  // Postgres publication (see supabase/migrations/054_game_room.sql's
  // ALTER PUBLICATION block); if that step didn't apply cleanly, the
  // channel joins successfully but silently never delivers an event, and
  // the dashboard would otherwise look permanently frozen with no error.
  // This keeps the leaderboard live regardless of whether Realtime is
  // actually working, at the cost of a slightly slower (5s) worst case.
  useEffect(() => {
    if (!state?.session.id || state.session.status === 'ended') return
    const sessionId = state.session.id
    const interval = setInterval(() => refreshState(sessionId), 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.session.id, state?.session.status])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    const res = await fetch('/api/game-room/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType,
        quizMode,
        count: quizMode === 'count' ? count : undefined,
        category: quizMode === 'category' ? category : undefined,
        timeLimitSeconds,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setCreating(false)

    if (!res.ok) {
      setCreateError(data.error || 'Failed to create game')
      return
    }

    setLoadingState(true)
    await refreshState(data.sessionId)
    setLoadingState(false)
  }

  async function handleStart() {
    if (!state) return
    const res = await fetch(`/api/game-room/sessions/${state.session.id}/start`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success('Game started!')
      await refreshState(state.session.id)
    } else {
      toast.error(data.error || 'Failed to start game')
    }
  }

  async function handlePause() {
    if (!state) return
    const res = await fetch(`/api/game-room/sessions/${state.session.id}/pause`, { method: 'POST' })
    if (res.ok) await refreshState(state.session.id)
    else toast.error('Failed to pause game')
  }

  async function handleResume() {
    if (!state) return
    const res = await fetch(`/api/game-room/sessions/${state.session.id}/resume`, { method: 'POST' })
    if (res.ok) await refreshState(state.session.id)
    else toast.error('Failed to resume game')
  }

  async function handleEnd() {
    if (!state) return
    const confirmed = await confirm({
      title: 'End this game?',
      description: 'This finishes the game for everyone immediately, even students still playing.',
      confirmLabel: 'End Game',
      tone: 'danger',
    })
    if (!confirmed) return

    const res = await fetch(`/api/game-room/sessions/${state.session.id}/end`, { method: 'POST' })
    if (res.ok) await refreshState(state.session.id)
    else toast.error('Failed to end game')
  }

  if (loadingState) {
    return <p className="text-sm text-stone-400 dark:text-stone-500">Loading...</p>
  }

  if (!state) {
    return (
      <form onSubmit={handleCreate} className="space-y-4 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        {createError && (
          <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
            {createError}
          </p>
        )}

        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Game</label>
          <select
            value={gameType}
            onChange={(e) => {
              setGameType(e.target.value)
              const g = games?.find((game) => game.id === e.target.value)
              setCategory(g?.categories?.[0]?.id ?? '')
            }}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          >
            {(games ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {selectedGame && <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">{selectedGame.description}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Quiz Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {(['count', 'category', 'full'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setQuizMode(mode)}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  quizMode === mode
                    ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                    : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                {mode === 'count' ? 'Question Count' : mode === 'category' ? 'Category' : 'Full Quiz'}
              </button>
            ))}
          </div>
        </div>

        {quizMode === 'count' && (
          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Number of Questions
            </label>
            <div className="grid grid-cols-4 gap-2">
              {COUNT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCount(c)}
                  className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                    count === c
                      ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                      : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {quizMode === 'category' && selectedGame && selectedGame.categories.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              {selectedGame.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
            Time Per Question
          </label>
          <div className="grid grid-cols-4 gap-2">
            {TIME_LIMITS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeLimitSeconds(t)}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  timeLimitSeconds === t
                    ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                    : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                {t}s
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" variant="primary" fullWidth disabled={creating || !gameType}>
          {creating ? 'Creating...' : 'Create Game'}
        </Button>
      </form>
    )
  }

  if (state.session.status === 'waiting') {
    return (
      <div className="space-y-6 text-center">
        <div className="p-8 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <p className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Game Code</p>
          <p className="text-6xl font-black text-primary-800 dark:text-primary-300 tracking-widest mt-2">
            {state.session.join_code}
          </p>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-3">Students go to /play and enter this code</p>
        </div>

        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <div className="flex items-center gap-2 justify-center mb-4">
            <FiUsers className="w-5 h-5 text-primary-700 dark:text-primary-400" />
            <p className="font-bold text-stone-800 dark:text-stone-100">Players Joined: {state.players.length}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {state.players.map((p) => (
              <Badge key={p.id} variant="secondary">
                {p.nickname}
              </Badge>
            ))}
          </div>
        </div>

        <Button variant="primary" fullWidth icon={<FiPlay />} onClick={handleStart} disabled={state.players.length === 0}>
          Start Game
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatTile label="Players" value={state.stats.totalPlayers} />
        <StatTile label="Completed" value={state.stats.completedCount} />
        <StatTile label="Playing" value={state.stats.playingCount} />
        <StatTile label="Avg Score" value={state.stats.avgScore} />
        <StatTile label="Avg Accuracy" value={`${state.stats.avgAccuracy}%`} />
      </div>

      {state.categoryAccuracy.length > 0 && (
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <p className="font-bold text-stone-800 dark:text-stone-100 mb-3">Category Performance</p>
          <div className="space-y-2">
            {state.categoryAccuracy.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="text-sm text-stone-600 dark:text-stone-300 w-32 shrink-0">{c.label}</span>
                <div className="flex-1 h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                  <div className="h-full bg-primary-600 dark:bg-primary-500" style={{ width: `${c.accuracy}%` }} />
                </div>
                <span className="text-sm font-semibold text-stone-700 dark:text-stone-200 w-12 text-right">{c.accuracy}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <p className="font-bold text-stone-800 dark:text-stone-100 mb-3">
          {state.session.status === 'ended' ? 'Final Leaderboard' : 'Live Leaderboard'}
        </p>
        <div className="space-y-1.5">
          {state.players.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg odd:bg-stone-50 dark:odd:bg-stone-800/40">
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-400 dark:text-stone-500 w-6">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <span className="font-semibold text-stone-800 dark:text-stone-100">{p.nickname}</span>
                {p.completed && (
                  <Badge variant="success" size="sm">
                    Done
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
                <span>
                  {p.current_index}/{state.session.question_count}
                </span>
                <span className="font-bold text-primary-700 dark:text-primary-400">{p.score}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {state.session.status !== 'ended' && (
        <div className="flex gap-2">
          {state.session.status === 'active' ? (
            <Button variant="outline" icon={<FiPause />} onClick={handlePause}>
              Pause
            </Button>
          ) : (
            <Button variant="outline" icon={<FiPlay />} onClick={handleResume}>
              Resume
            </Button>
          )}
          <Button variant="secondary" icon={<FiSquare />} onClick={handleEnd}>
            End Game
          </Button>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-center">
      <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{value}</p>
      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">{label}</p>
    </div>
  )
}
