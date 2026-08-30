'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiAward, FiUsers, FiClock } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/dashboard/EmptyState'

interface GameOption {
  id: string
  name: string
  description: string
  categories: { id: string; label: string }[]
  // Only present for the two Uyir Ezhuthukkal interactive games (see
  // lib/gameRoom/interactiveModule.ts) -- quiz-mode/count/category/timer
  // config is meaningless for these, so the form hides those fields and
  // starts the game via a different endpoint when this is true.
  interactive?: boolean
}

interface MyStats {
  totalPoints: number
  gamesPlayed: number
  rank: number | null
  totalStudentsRanked: number
  practiceSessionsPlayed: number
}

interface HistoryEntry {
  id: string
  gameName: string
  quizMode: string | null
  category: string | null
  isSoloPractice: boolean
  score: number
  correctCount: number
  answeredCount: number
  accuracy: number
  completedAt: string
}

interface LeaderboardEntry {
  student_id: string
  student_name: string
  total_points: number
  games_played: number
}

const COUNT_PRESETS = [10, 20, 30, 60]
const TIME_LIMITS = [10, 15, 20, 30]

type Tab = 'play' | 'history' | 'leaderboard'

export function GameRoomStudentClient() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('play')

  const [stats, setStats] = useState<MyStats | null>(null)
  const [games, setGames] = useState<GameOption[] | null>(null)
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null)

  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const [gameType, setGameType] = useState('')
  const [quizMode, setQuizMode] = useState<'full' | 'count' | 'category'>('count')
  const [count, setCount] = useState(20)
  const [category, setCategory] = useState('')
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(20)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/game-room/my-stats')
      .then((res) => res.json())
      .then(setStats)
      .catch(() => setStats(null))

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

  useEffect(() => {
    if (tab === 'history' && history === null) {
      fetch('/api/game-room/history')
        .then((res) => res.json())
        .then((data) => setHistory(data.history ?? []))
        .catch(() => setHistory([]))
    }
    if (tab === 'leaderboard' && leaderboard === null) {
      fetch('/api/game-room/leaderboard-alltime')
        .then((res) => res.json())
        .then((data) => setLeaderboard(data.leaderboard ?? []))
        .catch(() => setLeaderboard([]))
    }
  }, [tab, history, leaderboard])

  const selectedGame = games?.find((g) => g.id === gameType)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    setJoinError(null)

    const res = await fetch('/api/game-room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode }),
    })
    const data = await res.json().catch(() => ({}))
    setJoining(false)

    if (!res.ok) {
      setJoinError(data.error || 'Failed to join')
      return
    }

    router.push(`/student/game-room/${data.sessionId}`)
  }

  async function handleStartPractice(e: React.FormEvent) {
    e.preventDefault()
    setStarting(true)
    setStartError(null)

    // Interactive games (drag-order, memory-match) skip the quiz config
    // entirely -- they're a single "just press play" action, and the
    // board data comes back immediately in this same response instead of
    // being fetched separately by the play screen (see
    // [sessionId]/page.tsx's sessionStorage handoff below).
    if (selectedGame?.interactive) {
      const res = await fetch('/api/game-room/interactive/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameType }),
      })
      const data = await res.json().catch(() => ({}))
      setStarting(false)

      if (!res.ok) {
        setStartError(data.error || 'Failed to start game')
        return
      }

      sessionStorage.setItem(`gameRoom:${data.sessionId}:gameData`, JSON.stringify(data.gameData))
      sessionStorage.setItem(`gameRoom:${data.sessionId}:gameType`, gameType)
      router.push(`/student/game-room/${data.sessionId}`)
      return
    }

    const res = await fetch('/api/game-room/practice', {
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
    setStarting(false)

    if (!res.ok) {
      setStartError(data.error || 'Failed to start practice')
      return
    }

    router.push(`/student/game-room/${data.sessionId}`)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <FiAward className="w-5 h-5 mb-3 text-primary-700 dark:text-primary-400" />
          <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{stats?.totalPoints ?? '—'}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Total Points</p>
        </div>
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <FiUsers className="w-5 h-5 mb-3 text-primary-700 dark:text-primary-400" />
          <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{stats?.gamesPlayed ?? '—'}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Games Played</p>
        </div>
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <FiClock className="w-5 h-5 mb-3 text-primary-700 dark:text-primary-400" />
          <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">
            {stats?.rank ? `#${stats.rank}` : '—'}
          </p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Current Rank{stats?.totalStudentsRanked ? ` of ${stats.totalStudentsRanked}` : ''}
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-stone-200 dark:border-stone-800">
        {(['play', 'history', 'leaderboard'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-primary-700 text-primary-800 dark:border-primary-400 dark:text-primary-300'
                : 'border-transparent text-stone-500 dark:text-stone-400'
            }`}
          >
            {t === 'play' ? 'Play' : t === 'history' ? 'My History' : 'Leaderboard'}
          </button>
        ))}
      </div>

      {tab === 'play' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form onSubmit={handleJoin} className="space-y-3 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <h2 className="font-bold text-stone-800 dark:text-stone-100">Join a Game</h2>
            {joinError && (
              <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
                {joinError}
              </p>
            )}
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Game code"
              maxLength={8}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-center text-lg font-semibold tracking-widest focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
            <Button type="submit" variant="primary" fullWidth disabled={joining || !joinCode.trim()}>
              {joining ? 'Joining...' : 'Join Game'}
            </Button>
          </form>

          <form onSubmit={handleStartPractice} className="space-y-3 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <h2 className="font-bold text-stone-800 dark:text-stone-100">Practice on Your Own</h2>
            {startError && (
              <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
                {startError}
              </p>
            )}

            <select
              value={gameType}
              onChange={(e) => {
                setGameType(e.target.value)
                const g = games?.find((game) => game.id === e.target.value)
                setCategory(g?.categories?.[0]?.id ?? '')
              }}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              {(games ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            {!selectedGame?.interactive && (
              <div className="grid grid-cols-3 gap-1.5">
                {(['count', 'category', 'full'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setQuizMode(mode)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      quizMode === mode
                        ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                        : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {mode === 'count' ? 'Count' : mode === 'category' ? 'Category' : 'Full'}
                  </button>
                ))}
              </div>
            )}

            {!selectedGame?.interactive && quizMode === 'count' && (
              <div className="grid grid-cols-4 gap-1.5">
                {COUNT_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCount(c)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      count === c
                        ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                        : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {!selectedGame?.interactive && quizMode === 'category' && selectedGame && selectedGame.categories.length > 0 && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              >
                {selectedGame.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}

            {!selectedGame?.interactive && (
            <div className="grid grid-cols-4 gap-1.5">
              {TIME_LIMITS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeLimitSeconds(t)}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    timeLimitSeconds === t
                      ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                      : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {t}s
                </button>
              ))}
            </div>
            )}

            <Button type="submit" variant="outline" fullWidth disabled={starting || !gameType}>
              {starting ? 'Starting...' : selectedGame?.interactive ? 'Start Game' : 'Start Practice'}
            </Button>
          </form>
        </div>
      )}

      {tab === 'play' && (
        <button
          type="button"
          onClick={() => router.push('/student/game-room/word-formation')}
          className="w-full flex items-center justify-between p-5 rounded-2xl border border-primary-200 dark:border-primary-900 bg-white dark:bg-stone-900 hover:border-primary-400 transition-colors text-left"
        >
          <div>
            <h2 className="font-bold text-stone-800 dark:text-stone-100">சொல் உருவாக்குவோம்!</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              எழுத்துகளை இணைத்து சொற்களை உருவாக்குங்கள்! · Levels &amp; difficulty
            </p>
          </div>
          <span className="text-primary-700 dark:text-primary-400 font-semibold text-sm whitespace-nowrap">
            Play →
          </span>
        </button>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {history === null ? (
            <p className="text-sm text-stone-400 dark:text-stone-500">Loading...</p>
          ) : history.length === 0 ? (
            <EmptyState title="No games played yet" description="Join a class game or start a practice session to see your history here." />
          ) : (
            history.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-stone-800 dark:text-stone-100">{h.gameName}</p>
                    {h.isSoloPractice && (
                      <Badge variant="neutral" size="sm">
                        Practice
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    {new Date(h.completedAt).toLocaleDateString()} · {h.correctCount}/{h.answeredCount} correct ({h.accuracy}%)
                  </p>
                </div>
                <p className="text-xl font-bold text-primary-700 dark:text-primary-400">{h.score}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          {leaderboard === null ? (
            <p className="text-sm text-stone-400 dark:text-stone-500">Loading...</p>
          ) : leaderboard.length === 0 ? (
            <EmptyState title="No games played yet" description="The leaderboard fills in once students complete class games." />
          ) : (
            <div className="space-y-1.5">
              {leaderboard.map((entry, i) => (
                <div key={entry.student_id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg odd:bg-stone-50 dark:odd:bg-stone-800/40">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-400 dark:text-stone-500 w-6">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <span className="font-semibold text-stone-800 dark:text-stone-100">{entry.student_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
                    <span>{entry.games_played} games</span>
                    <span className="font-bold text-primary-700 dark:text-primary-400">{entry.total_points}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
