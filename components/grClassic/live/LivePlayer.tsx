'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FiAlertTriangle, FiCheckCircle, FiWifiOff, FiXCircle } from 'react-icons/fi'
import { PLAYER_HEADER, WRONG_ACCOUNT, type BoardRow, type PlayerState } from '@/lib/grClassic/live'
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
// The tab belongs to the student who joined (playerId): if the browser is
// signed in as someone else later, it stops and says so (WRONG_ACCOUNT).
export function LivePlayer({ sessionId, playerId, name, onLeft }: { sessionId: string; playerId: string; name: string; onLeft: (message: string) => void }) {
  const { data: s, error, offset } = usePoll<PlayerState>(`/live/${sessionId}/me`, 1000, playerId)
  const left = useServerCountdown(s?.status === 'question' ? s.endsAt : null, offset)
  const [sendError, setSendError] = useState('')
  // The answer this phone sent for a question. It keeps the buttons locked
  // even if a status check that left before the answer says "not answered".
  const [sent, setSent] = useState<{ questionId: string; choice: number } | null>(null)
  const [wrongAccount, setWrongAccount] = useState(false)
  const markWrongAccount = useCallback(() => setWrongAccount(true), [])
  useEffect(() => {
    if (error?.code === WRONG_ACCOUNT) setWrongAccount(true)
    else if (s && !error) setWrongAccount(false)
  }, [error, s])

  // Removed from the game (or it was never joined): back to the PIN screen.
  useEffect(() => {
    if (error?.status === 403 || error?.status === 404) onLeft(error.message)
  }, [error]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (questionId: string, choice: number) => {
    if (!s || sent?.questionId === questionId) return
    setSendError('')
    // Lock the buttons straight away; the server decides if it counted.
    setSent({ questionId, choice })
    const res = await grcApi(`/live/${sessionId}/answer`, { method: 'POST', body: { questionId, response: { kind: 'choice', choice } }, headers: { [PLAYER_HEADER]: playerId } })
    if (!res.ok) {
      if (res.code === WRONG_ACCOUNT) setWrongAccount(true)
      setSent(null)
      setSendError(res.error)
    }
  }

  if (wrongAccount) {
    return (
      <Screen>
        <section className="m-auto max-w-md text-center" role="alert">
          <FiAlertTriangle aria-hidden className="mx-auto h-16 w-16 text-amber-300" />
          <h1 className="mt-4 text-3xl font-black">Someone else signed in</h1>
          <p className="mt-3 text-lg font-bold text-white/85">
            This game is {name}’s, but this browser is now signed in as a different student. Your answers are paused so nobody gets the wrong points.
          </p>
          <p className="mt-4 font-semibold text-white/70">
            {name}: sign back in to carry on — this screen picks up where you left off. Everyone else: please play on your own device or browser.
          </p>
        </section>
      </Screen>
    )
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
  const chosen = s.myAnswer?.choice ?? (q && sent?.questionId === q.id ? sent.choice : null)

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
          {s.leaderboard && <Board rows={s.leaderboard} />}
          <p className="mt-4 font-bold text-white/70">{s.index + 1 < s.count ? 'Next question coming up…' : 'Winners coming up…'}</p>
        </section>
      )}

      {s.status === 'race' && s.questions && <Race sessionId={sessionId} playerId={playerId} onWrongAccount={markWrongAccount} questions={s.questions} doneIds={s.doneIds} score={s.score} rank={s.rank} />}
      {s.status === 'race' && s.leaderboard && <Board rows={s.leaderboard} max={5} title="Live scores" />}

      {s.status === 'ended' && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-7xl" aria-hidden>
            {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : '🌟'}
          </p>
          <h1 className="mt-4 text-4xl font-black">{s.rank ? `You came number ${s.rank}!` : 'Game over!'}</h1>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-amber-300">{s.score} points</p>
          <p className="mt-2 font-bold text-white/80">அருமை! Great playing.</p>
          {s.leaderboard && <Board rows={s.leaderboard} max={50} />}
          <ButtonLink href="/gr-classic/student" tone="plain" size="lg" className="mt-10">
            Back to GameRoom
          </ButtonLink>
        </section>
      )}
    </Screen>
  )
}

// The class leaderboard on a phone: the top players, plus this student's
// own row (highlighted) if they are further down.
function Board({ rows, max = 10, title = 'Leaderboard' }: { rows: BoardRow[]; max?: number; title?: string }) {
  const top = rows.slice(0, max)
  const me = rows.find((r) => r.me)
  const extra = me && !top.includes(me) ? me : null
  const row = (r: BoardRow) => (
    <motion.li key={r.nickname} layout className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${r.me ? 'bg-amber-300 text-indigo-950' : 'bg-white/10'}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-black ${r.rank <= 3 ? 'text-lg' : 'text-sm'} ${r.me ? 'bg-indigo-950 text-amber-300' : 'bg-white/20'}`}>{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
      <span className="min-w-0 flex-1 truncate text-left font-extrabold">
        {r.nickname}
        {r.me && ' (you)'}
      </span>
      {r.gained > 0 && <span className={`text-sm font-bold ${r.me ? 'text-emerald-800' : 'text-emerald-300'}`}>+{r.gained}</span>}
      <span className="font-black tabular-nums">{r.score}</span>
    </motion.li>
  )
  return (
    <section className="mt-6 w-full max-w-md" aria-label={title}>
      <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-white/70">{title}</h2>
      <ol className="space-y-1.5">
        {top.map(row)}
        {extra && (
          <>
            <li aria-hidden className="text-center font-black text-white/50">⋯</li>
            {row(extra)}
          </>
        )}
      </ol>
    </section>
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
function Race({ sessionId, playerId, onWrongAccount, questions, doneIds, score, rank }: { sessionId: string; playerId: string; onWrongAccount: () => void; questions: PlayQuestion[]; doneIds: string[]; score: number; rank: number | null }) {
  const [finished, setFinished] = useState<string[]>(doneIds)
  const current = questions.find((q) => !finished.includes(q.id)) ?? null
  const session: PlaySession = useMemo(
    () => ({
      async check(questionId: string, response: PlayResponse): Promise<CheckResult> {
        const res = await grcApi<CheckResult>(`/live/${sessionId}/answer`, { method: 'POST', body: { questionId, response }, headers: { [PLAYER_HEADER]: playerId } })
        if (!res.ok) {
          if (res.code === WRONG_ACCOUNT) onWrongAccount()
          throw new Error(res.error)
        }
        return res.data
      },
      async hint() {
        return { none: true as const }
      },
    }),
    [sessionId, playerId, onWrongAccount]
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
