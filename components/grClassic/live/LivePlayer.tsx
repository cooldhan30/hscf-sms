'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FiCheckCircle, FiWifiOff, FiXCircle } from 'react-icons/fi'
import type { PlayerState } from '@/lib/grClassic/live'
import type { CheckResult, PlayQuestion, PlayResponse, PlaySession } from '@/lib/grClassic/play'
import { AnswerButton } from '../games/AnswerButton'
import { MatchBoard } from '../games/MatchBoard'
import { WordBuilder } from '../games/WordBuilder'
import { grcApi } from '../teacher/api'
import { ButtonLink, Card } from '../ui'
import { usePoll, useServerCountdown } from './usePoll'

// One student's phone during a live game. It shows whatever step the
// teacher is on (polled from the server about once a second) and sends
// answers. It never knows the right answer until the teacher reveals it.
export function LivePlayer({ sessionId, onLeft }: { sessionId: string; onLeft: (message: string) => void }) {
  const { data: s, setData, error, offset } = usePoll<PlayerState>(`/live/${sessionId}/me`, 1000)
  const left = useServerCountdown(s?.status === 'question' ? s.endsAt : null, offset)
  const [sendError, setSendError] = useState('')

  // Removed from the game (or it was never joined): back to the PIN screen.
  useEffect(() => {
    if (error?.status === 403 || error?.status === 404) onLeft(error.message)
  }, [error]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (questionId: string, choice: number) => {
    if (!s) return
    setSendError('')
    // Lock the buttons straight away; the server decides if it counted.
    setData({ ...s, myAnswer: { choice, correct: null, points: null } })
    const res = await grcApi(`/live/${sessionId}/answer`, { method: 'POST', body: { questionId, response: { kind: 'choice', choice } } })
    if (!res.ok) {
      setData({ ...s, myAnswer: { choice: null, correct: null, points: null } })
      setSendError(res.error)
    }
  }

  if (!s) {
    return (
      <Screen>
        <p role="status" className="m-auto animate-pulse text-xl font-bold text-white/80">
          Joining…
        </p>
      </Screen>
    )
  }

  const q = s.question?.kind === 'choice' ? s.question : null
  const chosen = s.myAnswer?.choice ?? null

  return (
    <Screen>
      <header className="flex items-center justify-between gap-3 font-extrabold">
        <span className="truncate">{s.nickname}</span>
        {error && (
          <span className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1 text-sm" role="status">
            <FiWifiOff aria-hidden /> Reconnecting…
          </span>
        )}
        <span className="rounded-xl bg-white/10 px-3 py-1 tabular-nums">{s.score} pts</span>
      </header>

      {s.status === 'lobby' && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <motion.p animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} className="text-7xl" aria-hidden>
            🎉
          </motion.p>
          <h1 className="mt-4 text-3xl font-black">You’re in, {s.nickname}!</h1>
          <p className="mt-2 text-lg font-bold text-white/80">See your name on the big screen? Get ready…</p>
          <p className="mt-6 animate-pulse font-bold text-white/60">Waiting for your teacher to start · {s.playersCount} playing</p>
        </section>
      )}

      {s.status === 'question' && q && chosen === null && (
        <section className="flex flex-1 flex-col py-4">
          <div className="flex items-center justify-between font-bold text-white/80">
            <span>
              {s.index + 1} / {s.count}
            </span>
            <span role="timer" aria-label={`${Math.ceil(left ?? 0)} seconds left`} className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-xl font-black text-white">
              {Math.ceil(left ?? 0)}
            </span>
          </div>
          <h1 className="mt-4 text-center text-2xl font-black leading-[1.4] sm:text-3xl">{q.prompt}</h1>
          {left !== null && left <= 0 ? (
            <p className="m-auto text-3xl font-black">Time’s up! ⏰</p>
          ) : (
            <div className="mt-6 grid flex-1 content-center gap-4">
              {q.options.map((o, i) => (
                <AnswerButton key={i} index={i} text={o} size="xl" onClick={() => answer(q.id, i)} />
              ))}
            </div>
          )}
          {sendError && (
            <p role="alert" className="mt-3 text-center font-bold text-rose-300">
              {sendError}
            </p>
          )}
        </section>
      )}

      {s.status === 'question' && chosen !== null && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-6xl" aria-hidden>
            🔒
          </p>
          <h1 className="mt-4 text-3xl font-black">Answer locked in!</h1>
          <p className="mt-2 font-bold text-white/70">Waiting for everyone else…</p>
        </section>
      )}

      {s.status === 'reveal' && q && (
        <section className="flex flex-1 flex-col items-center justify-center text-center" role="status">
          {s.myAnswer?.correct ? <FiCheckCircle aria-hidden className="h-24 w-24 text-emerald-400" /> : <FiXCircle aria-hidden className="h-24 w-24 text-rose-400" />}
          <h1 className="mt-4 text-4xl font-black">{chosen === null ? 'No answer this time' : s.myAnswer?.correct ? 'சரி! Correct!' : 'Not this time'}</h1>
          {!s.myAnswer?.correct && s.correctIndex !== null && <p className="mt-2 text-xl font-bold">Answer: {q.options[s.correctIndex]}</p>}
          {(s.myAnswer?.points ?? 0) > 0 && <p className="mt-3 rounded-2xl bg-white/15 px-5 py-2 text-3xl font-black text-amber-300">+{s.myAnswer?.points}</p>}
        </section>
      )}

      {s.status === 'leaderboard' && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-6xl" aria-hidden>
            📊
          </p>
          <h1 className="mt-4 text-4xl font-black">You’re number {s.rank ?? '—'}</h1>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-amber-300">{s.score} points</p>
          <p className="mt-6 font-bold text-white/70">Look at the big screen!</p>
        </section>
      )}

      {s.status === 'race' && s.questions && <Race sessionId={sessionId} questions={s.questions} doneIds={s.doneIds} score={s.score} rank={s.rank} />}

      {s.status === 'ended' && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-7xl" aria-hidden>
            {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : '🌟'}
          </p>
          <h1 className="mt-4 text-4xl font-black">{s.rank ? `You came number ${s.rank}!` : 'Game over!'}</h1>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-amber-300">{s.score} points</p>
          <p className="mt-2 font-bold text-white/80">அருமை! Great playing.</p>
          {s.podium && s.podium.length > 0 && (
            <ol className="mt-6 space-y-1 text-lg font-bold">
              {s.podium.map((p) => (
                <li key={p.studentId}>
                  {p.rank}. {p.nickname} — {p.score}
                </li>
              ))}
            </ol>
          )}
          <ButtonLink href="/gr-classic/student" tone="plain" size="lg" className="mt-10">
            Back to GameRoom
          </ButtonLink>
        </section>
      )}
    </Screen>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-900 font-tamil text-white">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-4">{children}</div>
    </div>
  )
}

// Match the Pairs / Word Builder: everyone plays every question at their
// own pace; each answer is checked (right/wrong only) by the server.
function Race({ sessionId, questions, doneIds, score, rank }: { sessionId: string; questions: PlayQuestion[]; doneIds: string[]; score: number; rank: number | null }) {
  const [finished, setFinished] = useState<string[]>(doneIds)
  const current = questions.find((q) => !finished.includes(q.id)) ?? null
  const session: PlaySession = useMemo(
    () => ({
      async check(questionId: string, response: PlayResponse): Promise<CheckResult> {
        const res = await grcApi<CheckResult>(`/live/${sessionId}/answer`, { method: 'POST', body: { questionId, response } })
        if (!res.ok) throw new Error(res.error)
        return res.data
      },
      async hint() {
        return { none: true as const }
      },
    }),
    [sessionId]
  )
  const done = () => current && setTimeout(() => setFinished((f) => [...f, current.id]), 900)

  if (!current) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-7xl" aria-hidden>
          🏁
        </p>
        <h1 className="mt-4 text-3xl font-black">You finished!</h1>
        <p className="mt-2 text-2xl font-extrabold tabular-nums text-amber-300">
          {score} points{rank ? ` · number ${rank}` : ''}
        </p>
        <p className="mt-6 animate-pulse font-bold text-white/70">Waiting for your teacher…</p>
      </section>
    )
  }
  return (
    <section className="py-4">
      <p className="mb-3 text-center font-bold text-white/80">
        {finished.length + 1} / {questions.length}
      </p>
      <Card className="p-4 text-slate-900 sm:p-6">
        {current.kind === 'match' && <MatchBoard key={current.id} question={current} session={session} hints={false} onAnswered={done} />}
        {current.kind === 'order' && <WordBuilder key={current.id} question={current} session={session} reveal={false} hints={false} onAnswered={done} />}
      </Card>
    </section>
  )
}
