'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { FiPlay, FiSquare, FiUsers, FiArrowRight, FiEye } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { subscribeToMayangoliSession } from '@/lib/gameRoom/modules/mayangoli/realtime'
import { toast } from '@/lib/toast'

const GROUPS = [
  { id: 'l_group', label: 'ல் / ள் / ழ்' },
  { id: 'n_group', label: 'ன் / ண் / ந்' },
  { id: 'r_group', label: 'ர் / ற்' },
]
const DIFFICULTIES = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
]
const COUNT_PRESETS = [10, 20, 30]
const TIME_LIMITS = [10, 15, 20, 30]

interface LeaderboardEntry {
  id: string
  nickname: string
  score: number
  correct_count: number
  answered_count: number
  current_streak: number
  best_streak: number
  connected: boolean
}

interface Question {
  questionType: string
  prompt: string
  options: string[]
  supportingText: string | null
}

interface Reveal {
  correctAnswer: string
  totalAnswers: number
  correctAnswers: number
  fastestResponseMs: number | null
  percentCorrect: number
}

interface HostState {
  status: 'waiting' | 'active' | 'reveal' | 'ended'
  joinCode: string
  currentQuestionIndex: number
  totalQuestions: number
  leaderboard: LeaderboardEntry[]
  question: Question | null
  reveal: Reveal | null
}

interface LetterAccuracyRow {
  target_letter: string
  displayLetter: string
  total: number
  correct: number
  accuracy_pct: number | null
}

interface MayangoliHostClientProps {
  // Where the QR-code deep link points students to, and any extra
  // query params to append (e.g. a mode switch on a shared Game Room
  // join page) -- defaults to the original standalone Mayangoli join
  // page for any caller that doesn't care.
  joinLinkPath?: string
  joinLinkExtraParams?: string
}

export function MayangoliHostClient({ joinLinkPath = '/student/mayangoli', joinLinkExtraParams = '' }: MayangoliHostClientProps = {}) {
  const confirm = useConfirm()
  const supabase = useSupabaseBrowserClient()

  const [groupIds, setGroupIds] = useState<string[]>(GROUPS.map((g) => g.id))
  const [difficulties, setDifficulties] = useState<string[]>(['easy', 'medium'])
  const [count, setCount] = useState(10)
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(20)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [state, setState] = useState<HostState | null>(null)
  const [loadingState, setLoadingState] = useState(false)
  const [letterAccuracy, setLetterAccuracy] = useState<LetterAccuracyRow[] | null>(null)

  async function refreshState(id: string) {
    const res = await fetch('/api/mayangoli/host-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data) setState(data)
  }

  useEffect(() => {
    if (!sessionId) return
    const channel = subscribeToMayangoliSession(supabase, sessionId, () => refreshState(sessionId))
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Fallback poll in case Realtime isn't delivering events -- same
  // safety-net reasoning as the existing engine's host dashboard.
  useEffect(() => {
    if (!sessionId || state?.status === 'ended') return
    const interval = setInterval(() => refreshState(sessionId), 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, state?.status])

  // Once the game ends, fetch the one-time per-letter accuracy report
  // (not part of the polled/Realtime host-state payload since it's only
  // relevant post-game, and aggregating every answer is heavier than
  // the live dashboard's per-tick leaderboard read).
  useEffect(() => {
    if (!sessionId || state?.status !== 'ended' || letterAccuracy !== null) return
    fetch('/api/mayangoli/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => res.json())
      .then((data) => setLetterAccuracy(data.letterAccuracy ?? []))
      .catch(() => setLetterAccuracy([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, state?.status])

  function toggleGroup(id: string) {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))
  }
  function toggleDifficulty(id: string) {
    setDifficulties((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    const res = await fetch('/api/mayangoli/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupIds, difficulties, count, timeLimitSeconds }),
    })
    const data = await res.json().catch(() => ({}))
    setCreating(false)

    if (!res.ok) {
      setCreateError(data.error || 'Failed to create game')
      return
    }

    setLoadingState(true)
    setSessionId(data.sessionId)
    await refreshState(data.sessionId)
    setLoadingState(false)
  }

  async function handleStart() {
    if (!sessionId) return
    const res = await fetch('/api/mayangoli/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success('Game started!')
      await refreshState(sessionId)
    } else {
      toast.error(data.error || 'Failed to start game')
    }
  }

  async function handleReveal() {
    if (!sessionId) return
    const res = await fetch('/api/mayangoli/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action: 'reveal' }),
    })
    if (res.ok) await refreshState(sessionId)
    else toast.error('Failed to reveal answer')
  }

  async function handleNext() {
    if (!sessionId) return
    const res = await fetch('/api/mayangoli/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action: 'next' }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      if (data.status === 'ended') toast.success('Game finished!')
      await refreshState(sessionId)
    } else {
      toast.error('Failed to advance')
    }
  }

  async function handleEnd() {
    if (!sessionId) return
    const confirmed = await confirm({
      title: 'End this game?',
      description: 'This finishes the game for everyone immediately, even students still playing.',
      confirmLabel: 'End Game',
      tone: 'danger',
    })
    if (!confirmed) return

    const res = await fetch('/api/mayangoli/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    if (res.ok) await refreshState(sessionId)
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
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Letter Groups</label>
          <div className="grid grid-cols-3 gap-2">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGroup(g.id)}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors font-tamil ${
                  groupIds.includes(g.id)
                    ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                    : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Difficulty</label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDifficulty(d.id)}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  difficulties.includes(d.id)
                    ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                    : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Number of Questions</label>
          <div className="grid grid-cols-3 gap-2">
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

        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Time Per Question</label>
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

        <Button type="submit" variant="primary" fullWidth disabled={creating || groupIds.length === 0 || difficulties.length === 0}>
          {creating ? 'Creating...' : 'Create Game'}
        </Button>
      </form>
    )
  }

  if (state.status === 'waiting') {
    return (
      <div className="space-y-6 text-center">
        <div className="p-8 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <p className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Game Code</p>
          <p className="text-6xl font-black text-primary-800 dark:text-primary-300 tracking-widest mt-2">{state.joinCode}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-3">Students go to Game Room and enter this code</p>
          <div className="flex justify-center mt-5">
            <div className="p-3 bg-white rounded-xl">
              <QRCodeSVG
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}${joinLinkPath}?code=${state.joinCode}${joinLinkExtraParams}`}
                size={140}
              />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <div className="flex items-center gap-2 justify-center mb-4">
            <FiUsers className="w-5 h-5 text-primary-700 dark:text-primary-400" />
            <p className="font-bold text-stone-800 dark:text-stone-100">Players Joined: {state.leaderboard.length}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {state.leaderboard.map((p) => (
              <Badge key={p.id} variant="secondary">
                {p.nickname}
              </Badge>
            ))}
          </div>
        </div>

        <Button variant="primary" fullWidth icon={<FiPlay />} onClick={handleStart} disabled={state.leaderboard.length === 0}>
          Start Game
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-stone-500 dark:text-stone-400">
        <span>
          Question {state.currentQuestionIndex + 1} / {state.totalQuestions}
        </span>
        {state.status !== 'ended' && <Badge variant={state.status === 'reveal' ? 'gold' : 'primary'}>{state.status === 'reveal' ? 'Revealed' : 'Live'}</Badge>}
      </div>

      {state.question && state.status !== 'ended' && (
        <div className="p-6 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-center">
          {state.question.supportingText && (
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-2">{state.question.supportingText}</p>
          )}
          <p className="text-4xl font-black text-stone-800 dark:text-stone-100 font-tamil">{state.question.prompt}</p>

          <div className="grid grid-cols-2 gap-3 mt-6">
            {state.question.options.map((opt) => {
              const isCorrect = state.status === 'reveal' && state.reveal && opt === state.reveal.correctAnswer
              return (
                <div
                  key={opt}
                  className={`py-4 rounded-2xl border-2 text-xl font-bold font-tamil ${
                    isCorrect
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200'
                  }`}
                >
                  {opt}
                </div>
              )
            })}
          </div>

          {state.status === 'reveal' && state.reveal && (
            <p className="mt-5 text-sm font-semibold text-stone-600 dark:text-stone-300">
              {state.reveal.percentCorrect}% answered correctly ({state.reveal.correctAnswers}/{state.reveal.totalAnswers})
            </p>
          )}
        </div>
      )}

      {state.status === 'ended' && letterAccuracy && letterAccuracy.length > 0 && (
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <p className="font-bold text-stone-800 dark:text-stone-100 mb-3">Letter Accuracy</p>
          <div className="space-y-2">
            {letterAccuracy.map((row) => {
              const pct = row.accuracy_pct ?? 0
              const needsPractice = pct < 70
              return (
                <div key={row.target_letter} className="flex items-center gap-3">
                  <span className="text-lg font-bold font-tamil text-stone-700 dark:text-stone-200 w-10 shrink-0">{row.displayLetter}</span>
                  <div className="flex-1 h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                    <div
                      className={`h-full ${needsPractice ? 'bg-terracotta-500 dark:bg-terracotta-500' : 'bg-emerald-600 dark:bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-stone-700 dark:text-stone-200 w-12 text-right">{pct}%</span>
                  {needsPractice && (
                    <Badge variant="secondary" size="sm">
                      Needs Practice
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <p className="font-bold text-stone-800 dark:text-stone-100 mb-3">
          {state.status === 'ended' ? 'Final Leaderboard' : 'Live Leaderboard'}
        </p>
        <div className="space-y-1.5">
          {state.leaderboard.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg odd:bg-stone-50 dark:odd:bg-stone-800/40">
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-400 dark:text-stone-500 w-6">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <span className="font-semibold text-stone-800 dark:text-stone-100">{p.nickname}</span>
                {p.current_streak >= 3 && <Badge variant="gold" size="sm">🔥{p.current_streak}</Badge>}
              </div>
              <span className="font-bold text-primary-700 dark:text-primary-400">{p.score}</span>
            </div>
          ))}
        </div>
      </div>

      {state.status !== 'ended' && (
        <div className="flex gap-2">
          {state.status === 'active' ? (
            <Button variant="primary" icon={<FiEye />} onClick={handleReveal}>
              Reveal Answer
            </Button>
          ) : (
            <Button variant="primary" icon={<FiArrowRight />} onClick={handleNext}>
              {state.currentQuestionIndex + 1 >= state.totalQuestions ? 'Finish Game' : 'Next Question'}
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
