'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { FiUsers, FiWifiOff, FiX } from 'react-icons/fi'
import type { HostState, LiveStatus } from '@/lib/grClassic/live'
import type { ChoiceQuestion } from '@/lib/grClassic/types'
import { ANSWER_STYLES } from '../games/AnswerButton'
import { Confetti } from '../games/Confetti'
import { grcApi } from '../teacher/api'
import { Button, Logo, TYPE_META } from '../ui'
import { QrCode } from './QrCode'
import { usePoll, useServerCountdown } from './usePoll'

// The teacher's projector view of a live game. The server owns the clock,
// the answers and the scores; this screen shows them and sends the
// teacher's Next / End / Play again. Classic Quiz runs question by
// question; Match and Word Builder run as a race.
export function HostLive({ sessionId }: { sessionId: string }) {
  const { data: s, setData, error, offset, refresh } = usePoll<HostState>(`/live/${sessionId}/host`, 1000)
  const [busy, setBusy] = useState(false)
  const [joinUrl, setJoinUrl] = useState('')
  const autoRevealed = useRef(-1)
  const left = useServerCountdown(s?.status === 'question' ? s.endsAt : null, offset)
  const connected = s?.players.filter((p) => p.connected).length ?? 0

  useEffect(() => {
    if (!s) return
    // Same site and base path as this page (e.g. https://tamilschoolfl.org/tamizhi).
    const base = window.location.pathname.split('/gr-classic')[0]
    setJoinUrl(`${window.location.origin}${base}/gr-classic/join?pin=${s.pin}`)
  }, [s?.pin]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action: 'next' | 'end' | 'again', expect: { status: LiveStatus; index: number }) => {
    setBusy(true)
    const res = await grcApi<HostState>(`/live/${sessionId}/host`, { method: 'POST', body: { action, expect } })
    setBusy(false)
    if (res.ok) setData(res.data)
    else refresh()
  }

  // Time up, or everyone connected has answered: show the answer.
  useEffect(() => {
    if (!s || s.status !== 'question' || autoRevealed.current === s.index) return
    if ((left !== null && left <= 0) || (connected > 0 && s.answered >= connected)) {
      autoRevealed.current = s.index
      act('next', { status: 'question', index: s.index })
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) {
    return (
      <Screen>
        <p role="status" className="m-auto animate-pulse text-2xl font-bold text-white/80">
          {error ? error.message : 'Opening the live game…'}
        </p>
      </Screen>
    )
  }

  const m = TYPE_META[s.type]
  const expect = { status: s.status, index: s.index }
  const q = s.question?.kind === 'choice' ? (s.question as ChoiceQuestion) : null

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <Logo />
        <p className="min-w-0 flex-1 truncate text-lg font-extrabold">
          {s.title} <span className="font-semibold text-white/60">· {s.className}</span>
        </p>
        {error && (
          <span className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-sm font-bold" role="status">
            <FiWifiOff aria-hidden /> Reconnecting…
          </span>
        )}
        <span className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 font-extrabold" title="Players connected / joined">
          <FiUsers aria-hidden /> {connected}/{s.players.length}
        </span>
        {s.status !== 'ended' ? (
          <button type="button" onClick={() => act('end', expect)} className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 font-bold hover:bg-white/20">
            <FiX aria-hidden /> End game
          </button>
        ) : (
          <Link href="/gr-classic/teacher" className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 font-bold hover:bg-white/20">
            <FiX aria-hidden /> Close
          </Link>
        )}
      </header>

      {s.status === 'lobby' && (
        <section className="flex flex-1 flex-col items-center py-6 text-center">
          <div className="flex flex-col items-center gap-6 md:flex-row md:gap-10">
            {joinUrl && <QrCode text={joinUrl} size={200} label={`QR code to join with PIN ${s.pin}`} />}
            <div>
              <p className="text-lg font-bold text-white/80">Scan the code, or go to GameRoom Classic → Join Live Game</p>
              <p className="mt-4 text-lg font-extrabold uppercase tracking-[0.3em] text-amber-300">Game PIN</p>
              <p className="font-sans text-7xl font-black tracking-[0.15em] sm:text-8xl" aria-label={`Game PIN ${s.pin.split('').join(' ')}`}>
                {s.pin.slice(0, 3)} {s.pin.slice(3)}
              </p>
            </div>
          </div>
          <ul className="mt-8 flex max-w-4xl flex-wrap justify-center gap-3" aria-live="polite" aria-label="Players">
            <AnimatePresence>
              {s.players.map((p) => (
                <motion.li key={p.studentId} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`rounded-2xl px-4 py-2 text-lg font-extrabold shadow-lg ${p.connected ? 'bg-white text-indigo-900' : 'bg-white/30 text-white'}`}>
                  {p.nickname}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {s.players.length === 0 && <p className="mt-6 animate-pulse text-xl font-bold text-white/70">Waiting for players…</p>}
          <div className="mt-auto pt-10">
            <Button tone="amber" size="lg" disabled={s.players.length === 0 || busy} onClick={() => act('next', expect)}>
              Start game ▶
            </Button>
          </div>
        </section>
      )}

      {s.status === 'question' && q && (
        <section className="flex flex-1 flex-col py-6">
          <div className="flex items-center justify-between gap-4 text-lg font-extrabold">
            <span className="rounded-xl bg-white/10 px-3 py-1">
              {s.index + 1} / {s.count}
            </span>
            <span className="rounded-xl bg-white/10 px-3 py-1" aria-live="polite">
              {s.answered} of {connected} answered
            </span>
          </div>
          <h2 className="mx-auto mt-6 max-w-4xl rounded-3xl bg-white px-6 py-8 text-center text-3xl font-black leading-[1.4] text-slate-900 shadow-2xl sm:text-5xl sm:leading-[1.4]">{q.prompt}</h2>
          <div className="my-8 flex justify-center">
            <TimerRing left={Math.ceil(left ?? 0)} total={s.liveSeconds} />
          </div>
          <AnswerGrid q={q} />
          <div className="mt-6 text-center">
            <Button tone="plain" disabled={busy} onClick={() => act('next', expect)}>
              Stop timer & show answer
            </Button>
          </div>
        </section>
      )}

      {s.status === 'reveal' && q && (
        <section className="flex flex-1 flex-col py-6">
          <h2 className="mx-auto max-w-4xl text-center text-2xl font-black leading-[1.4] sm:text-4xl">{q.prompt}</h2>
          {s.distribution && <Distribution q={q} counts={s.distribution} />}
          <AnswerGrid q={q} reveal />
          {q.explanation && <p className="mx-auto mt-6 max-w-3xl rounded-2xl bg-white/10 px-5 py-3 text-center text-lg font-bold">{q.explanation}</p>}
          <div className="mt-8 text-center">
            <Button tone="amber" size="lg" disabled={busy} onClick={() => act('next', expect)}>
              Next ▶
            </Button>
          </div>
        </section>
      )}

      {s.status === 'leaderboard' && (
        <section className="flex flex-1 flex-col items-center py-8">
          <h2 className="text-4xl font-black">Leaderboard</h2>
          <ol className="mt-8 w-full max-w-2xl space-y-3">
            {s.standings.slice(0, 5).map((p) => (
              <motion.li key={p.studentId} layout className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 text-slate-900 shadow-lg">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-600 text-lg font-black text-white">{p.rank}</span>
                <span className="flex-1 text-2xl font-extrabold">{p.nickname}</span>
                {(s.gained[p.studentId] ?? 0) > 0 && <span className="font-bold text-emerald-600">+{s.gained[p.studentId]}</span>}
                <span className="text-2xl font-black tabular-nums">{p.score}</span>
              </motion.li>
            ))}
          </ol>
          <div className="mt-auto pt-10">
            <Button tone="amber" size="lg" disabled={busy} onClick={() => act('next', expect)}>
              {s.index + 1 < s.count ? 'Next question ▶' : 'Show winners 🏆'}
            </Button>
          </div>
        </section>
      )}

      {s.status === 'race' && s.race && (
        <section className="flex flex-1 flex-col py-6">
          <h2 className="text-center text-3xl font-black sm:text-4xl">Everyone is playing {m.label}!</h2>
          <p className="text-center font-bold text-white/70">
            {s.race.filter((p) => p.finished).length} of {s.race.length} finished · {s.count} {s.type === 'match' ? 'boards' : 'questions'} each
          </p>
          <ol className="mx-auto mt-8 w-full max-w-3xl space-y-2.5">
            {s.race.map((p) => (
              <motion.li key={p.studentId} layout className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-lg font-extrabold">{p.nickname}</span>
                <span className="h-6 flex-1 overflow-hidden rounded-full bg-white/15">
                  <span className={`block h-full rounded-full ${p.finished ? 'bg-emerald-400' : 'bg-amber-400'} transition-[width] duration-700`} style={{ width: `${(100 * p.done) / s.count}%` }} />
                </span>
                <span className="w-16 text-right font-black tabular-nums">{p.score}</span>
              </motion.li>
            ))}
          </ol>
          <div className="mt-8 text-center">
            <Button tone="amber" size="lg" disabled={busy} onClick={() => act('next', expect)}>
              End game & show winners 🏆
            </Button>
          </div>
        </section>
      )}

      {s.status === 'ended' && <Podium s={s} onAgain={() => act('again', expect)} busy={busy} />}
    </Screen>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-900 font-tamil text-white">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-4 sm:px-8">{children}</div>
    </div>
  )
}

function TimerRing({ left, total }: { left: number; total: number }) {
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-28 w-28" role="timer" aria-label={`${left} seconds left`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={left <= 5 ? '#fb7185' : '#fbbf24'} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, left / total))} className="transition-[stroke-dashoffset] duration-300" />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-4xl font-black tabular-nums">{left}</span>
    </div>
  )
}

function AnswerGrid({ q, reveal }: { q: ChoiceQuestion; reveal?: boolean }) {
  return (
    <ul className="mx-auto grid w-full max-w-5xl gap-4 sm:grid-cols-2">
      {q.options.map((o, i) => {
        const s = ANSWER_STYLES[i]
        const dim = reveal && i !== q.answerIndex
        return (
          <li key={i} className={`flex min-h-[5.5rem] items-center gap-4 rounded-3xl px-6 py-4 text-3xl font-black transition ${s.cls} ${dim ? 'opacity-30' : ''} ${reveal && !dim ? 'ring-8 ring-emerald-400' : ''}`}>
            <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/25">
              <s.icon className="h-7 w-7" strokeWidth={3} />
            </span>
            {o}
            {reveal && !dim && <span className="ml-auto">✓</span>}
          </li>
        )
      })}
    </ul>
  )
}

function Distribution({ q, counts }: { q: ChoiceQuestion; counts: number[] }) {
  const most = Math.max(1, ...counts)
  return (
    <div className="mx-auto my-8 flex h-44 w-full max-w-2xl items-end justify-center gap-4" aria-label="How the class answered">
      {counts.map((n, i) => {
        const Icon = ANSWER_STYLES[i].icon
        return (
          <div key={i} className="flex h-full w-20 flex-col items-center justify-end gap-1">
            <span className="text-2xl font-black">{n}</span>
            <motion.div initial={{ height: 0 }} animate={{ height: `${(n / most) * 100}%` }} className={`w-full rounded-t-2xl ${ANSWER_STYLES[i].cls.split(' ')[0]} ${i === q.answerIndex ? '' : 'opacity-50'}`} style={{ minHeight: 6 }} />
            <Icon aria-label={ANSWER_STYLES[i].name} className="h-6 w-6" strokeWidth={3} />
          </div>
        )
      })}
    </div>
  )
}

function Podium({ s, onAgain, busy }: { s: HostState; onAgain: () => void; busy: boolean }) {
  const top = s.standings
  const places = [
    { p: top[1], h: 'h-40', medal: '🥈', delay: 0.4 },
    { p: top[0], h: 'h-56', medal: '🥇', delay: 0.9 },
    { p: top[2], h: 'h-28', medal: '🥉', delay: 0 },
  ].filter((x) => x.p)
  return (
    <section className="flex flex-1 flex-col items-center py-8">
      {top.length > 0 && <Confetti pieces={60} />}
      <h2 className="text-4xl font-black sm:text-5xl">வெற்றியாளர்கள்! 🏆</h2>
      {top.length === 0 && <p className="mt-6 text-xl font-bold text-white/70">Nobody played this time.</p>}
      <div className="mt-10 flex w-full max-w-3xl items-end justify-center gap-3 sm:gap-6">
        {places.map(({ p, h, medal, delay }) => (
          <motion.div key={p.studentId} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay, type: 'spring', stiffness: 120 }} className="flex flex-1 flex-col items-center">
            <span className="text-5xl" aria-hidden>
              {medal}
            </span>
            <span className="mt-1 max-w-full truncate text-2xl font-black">{p.nickname}</span>
            <span className="font-bold tabular-nums text-white/80">{p.score}</span>
            <div className={`mt-2 grid w-full place-items-center rounded-t-3xl bg-white/90 text-5xl font-black text-indigo-900 ${h}`} aria-label={`Place ${p.rank}`}>
              {p.rank}
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button tone="amber" size="lg" onClick={onAgain} disabled={busy}>
          Play again
        </Button>
        <Link href="/gr-classic/teacher" className="inline-flex items-center rounded-2xl bg-white/10 px-6 py-4 text-lg font-bold hover:bg-white/20">
          Done
        </Link>
      </div>
      <p className="mt-6 max-w-xl text-center text-sm font-semibold text-white/60">Points are just for fun — they are not grades.</p>
    </section>
  )
}
