'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { FiUsers, FiX } from 'react-icons/fi'
import { livePoints } from '@/lib/grClassic/scoring'
import { LIVE_ROSTER, SAMPLE_LIVE_PIN } from '@/lib/grClassic/sampleData'
import type { ChoiceQuestion, Game } from '@/lib/grClassic/types'
import { ANSWER_STYLES } from '../games/AnswerButton'
import { Confetti } from '../games/Confetti'
import { Button, Logo, TYPE_META } from '../ui'

type Player = { name: string; score: number; gained: number; choice: number | null; progress: number }
type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'race' | 'podium'

// Teacher's projector view of a live game. Prototype: players and their
// answers are simulated in the browser. In Phase 5 the server owns the
// clock, the answers and the scores; this screen only displays them.
//
// Classic Quiz runs question by question. Match and Word Builder run as a
// race: everyone plays the whole game on their own device at once and the
// projector shows a live progress board.
export function HostLive({ game }: { game: Game }) {
  const quiz = game.type === 'quiz'
  const questions = game.questions as ChoiceQuestion[]
  const [phase, setPhase] = useState<Phase>('lobby')
  const [players, setPlayers] = useState<Player[]>([])
  const [qi, setQi] = useState(0)
  const [left, setLeft] = useState(game.liveSeconds)
  const startedAt = useRef(0)
  const plan = useRef<{ at: number; choice: number }[]>([])
  const revealed = useRef(false)
  const q = questions[qi]

  // Lobby: students "join" one by one.
  useEffect(() => {
    if (phase !== 'lobby' || players.length >= LIVE_ROSTER.length) return
    const t = setTimeout(() => setPlayers((ps) => [...ps, { name: LIVE_ROSTER[ps.length], score: 0, gained: 0, choice: null, progress: 0 }]), 650)
    return () => clearTimeout(t)
  }, [phase, players.length])

  const startQuestion = (i: number) => {
    setQi(i)
    setLeft(game.liveSeconds)
    startedAt.current = Date.now()
    const opts = questions[i].options.length
    plan.current = players.map(() => ({
      // Simulated class: everyone answers within ~9 seconds.
      at: 1000 + Math.random() * Math.min(8000, game.liveSeconds * 1000 - 3000),
      choice: Math.random() < 0.7 ? questions[i].answerIndex : Math.floor(Math.random() * opts),
    }))
    setPlayers((ps) => ps.map((p) => ({ ...p, choice: null, gained: 0 })))
    revealed.current = false
    setPhase('question')
  }

  const reveal = () => {
    if (revealed.current) return
    revealed.current = true
    const limit = game.liveSeconds * 1000
    setPlayers((ps) =>
      ps.map((p, k) => {
        const choice = plan.current[k].at <= Date.now() - startedAt.current ? plan.current[k].choice : p.choice
        const gained = choice === null ? 0 : livePoints(choice === q.answerIndex, plan.current[k].at, limit)
        return { ...p, choice, gained, score: p.score + gained }
      })
    )
    setPhase('reveal')
  }

  // Question clock + simulated answers arriving.
  useEffect(() => {
    if (phase !== 'question') return
    const t = setInterval(() => {
      const ms = Date.now() - startedAt.current
      setLeft(Math.max(0, Math.ceil(game.liveSeconds - ms / 1000)))
      setPlayers((ps) => ps.map((p, k) => (p.choice === null && plan.current[k].at <= ms ? { ...p, choice: plan.current[k].choice } : p)))
      if (ms >= game.liveSeconds * 1000 || plan.current.every((x) => x.at <= ms)) reveal()
    }, 250)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qi])

  // Race: everyone's progress ticks up at their own pace.
  useEffect(() => {
    if (phase !== 'race') return
    const t = setInterval(() => {
      setPlayers((ps) => {
        let done = ps.filter((p) => p.progress >= 1).length
        const next = ps.map((p) => {
          if (p.progress >= 1) return p
          const progress = Math.min(1, p.progress + Math.random() * 0.12)
          if (progress < 1) return { ...p, progress }
          done++
          return { ...p, progress, score: p.score + Math.max(300, 1200 - done * 80) + Math.round(Math.random() * 200) }
        })
        return next
      })
    }, 700)
    return () => clearInterval(t)
  }, [phase])

  const ranked = useMemo(() => players.slice().sort((a, b) => b.score - a.score), [players])
  const answered = players.filter((p) => p.choice !== null).length
  const m = TYPE_META[game.type]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-900 font-tamil text-white">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-4 sm:px-8">
        <header className="flex items-center gap-3">
          <Logo />
          <p className="min-w-0 flex-1 truncate text-lg font-extrabold">{game.title}</p>
          <span className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 font-extrabold">
            <FiUsers aria-hidden /> {players.length}
          </span>
          <Link href="/gr-classic/teacher" className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 font-bold hover:bg-white/20">
            <FiX aria-hidden /> End
          </Link>
        </header>

        {phase === 'lobby' && (
          <section className="flex flex-1 flex-col items-center py-8 text-center">
            <p className="text-xl font-bold text-white/80">Join at tamilschoolfl.org/tamizhi → GameRoom Classic → Join Live Game</p>
            <p className="mt-6 text-lg font-extrabold uppercase tracking-[0.3em] text-amber-300">Game PIN</p>
            <p className="font-sans text-7xl font-black tracking-[0.15em] sm:text-9xl" aria-label={`Game PIN ${SAMPLE_LIVE_PIN.split('').join(' ')}`}>
              {SAMPLE_LIVE_PIN.slice(0, 3)} {SAMPLE_LIVE_PIN.slice(3)}
            </p>
            <p className="mt-2 rounded-xl bg-white/10 px-3 py-1 text-sm font-semibold text-white/70">QR code arrives in Phase 5</p>
            <ul className="mt-8 flex max-w-4xl flex-wrap justify-center gap-3" aria-live="polite" aria-label="Players">
              <AnimatePresence>
                {players.map((p) => (
                  <motion.li key={p.name} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-2xl bg-white px-4 py-2 text-lg font-extrabold text-indigo-900 shadow-lg">
                    {p.name}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {players.length === 0 && <p className="mt-6 animate-pulse text-xl font-bold text-white/70">Waiting for players…</p>}
            <div className="mt-auto pt-10">
              <Button tone="amber" size="lg" disabled={players.length === 0} onClick={() => (quiz ? startQuestion(0) : setPhase('race'))}>
                Start game ▶
              </Button>
            </div>
          </section>
        )}

        {phase === 'question' && (
          <section className="flex flex-1 flex-col py-6">
            <div className="flex items-center justify-between gap-4 text-lg font-extrabold">
              <span className="rounded-xl bg-white/10 px-3 py-1">
                {qi + 1} / {questions.length}
              </span>
              <span className="rounded-xl bg-white/10 px-3 py-1" aria-live="polite">
                {answered} answered
              </span>
            </div>
            <h2 className="mx-auto mt-6 max-w-4xl rounded-3xl bg-white px-6 py-8 text-center text-3xl font-black leading-[1.4] text-slate-900 shadow-2xl sm:text-5xl sm:leading-[1.4]">{q.prompt}</h2>
            <div className="my-8 flex justify-center">
              <TimerRing left={left} total={game.liveSeconds} />
            </div>
            <AnswerGrid q={q} />
            <div className="mt-6 text-center">
              <Button tone="plain" onClick={reveal}>
                Stop timer & show answer
              </Button>
            </div>
          </section>
        )}

        {phase === 'reveal' && (
          <section className="flex flex-1 flex-col py-6">
            <h2 className="mx-auto max-w-4xl text-center text-2xl font-black leading-[1.4] sm:text-4xl">{q.prompt}</h2>
            <Distribution q={q} players={players} />
            <AnswerGrid q={q} reveal />
            {q.explanation && <p className="mx-auto mt-6 max-w-3xl rounded-2xl bg-white/10 px-5 py-3 text-center text-lg font-bold">{q.explanation}</p>}
            <div className="mt-8 text-center">
              <Button tone="amber" size="lg" onClick={() => setPhase('leaderboard')}>
                Next ▶
              </Button>
            </div>
          </section>
        )}

        {phase === 'leaderboard' && (
          <section className="flex flex-1 flex-col items-center py-8">
            <h2 className="text-4xl font-black">Leaderboard</h2>
            <ol className="mt-8 w-full max-w-2xl space-y-3">
              {ranked.slice(0, 5).map((p, i) => (
                <motion.li key={p.name} layout className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 text-slate-900 shadow-lg">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-600 text-lg font-black text-white">{i + 1}</span>
                  <span className="flex-1 text-2xl font-extrabold">{p.name}</span>
                  {p.gained > 0 && <span className="font-bold text-emerald-600">+{p.gained}</span>}
                  <span className="text-2xl font-black tabular-nums">{p.score}</span>
                </motion.li>
              ))}
            </ol>
            <div className="mt-auto pt-10">
              <Button tone="amber" size="lg" onClick={() => (qi + 1 < questions.length ? startQuestion(qi + 1) : setPhase('podium'))}>
                {qi + 1 < questions.length ? 'Next question ▶' : 'Show winners 🏆'}
              </Button>
            </div>
          </section>
        )}

        {phase === 'race' && (
          <section className="flex flex-1 flex-col py-6">
            <h2 className="text-center text-3xl font-black sm:text-4xl">
              Everyone is playing {m.label}!
            </h2>
            <p className="text-center font-bold text-white/70">
              {players.filter((p) => p.progress >= 1).length} of {players.length} finished
            </p>
            <ol className="mx-auto mt-8 w-full max-w-3xl space-y-2.5">
              {ranked.map((p) => (
                <motion.li key={p.name} layout className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-lg font-extrabold">{p.name}</span>
                  <span className="h-6 flex-1 overflow-hidden rounded-full bg-white/15">
                    <span className={`block h-full rounded-full ${p.progress >= 1 ? 'bg-emerald-400' : 'bg-amber-400'} transition-[width] duration-700`} style={{ width: `${p.progress * 100}%` }} />
                  </span>
                  <span className="w-16 text-right font-black tabular-nums">{p.progress >= 1 ? p.score : `${Math.round(p.progress * 100)}%`}</span>
                </motion.li>
              ))}
            </ol>
            <div className="mt-8 text-center">
              <Button tone="amber" size="lg" onClick={() => setPhase('podium')}>
                End game & show winners 🏆
              </Button>
            </div>
          </section>
        )}

        {phase === 'podium' && <Podium ranked={ranked} onAgain={() => { setPlayers((ps) => ps.map((p) => ({ ...p, score: 0, gained: 0, choice: null, progress: 0 }))); setPhase('lobby') }} />}
      </div>
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
        <circle cx="50" cy="50" r={r} fill="none" stroke={left <= 5 ? '#fb7185' : '#fbbf24'} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - left / total)} className="transition-[stroke-dashoffset] duration-300" />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-4xl font-black tabular-nums">{left}</span>
    </div>
  )
}

function AnswerGrid({ q, reveal }: { q: ChoiceQuestion; reveal?: boolean }) {
  return (
    <ul className={`mx-auto grid w-full max-w-5xl gap-4 sm:grid-cols-2`}>
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

function Distribution({ q, players }: { q: ChoiceQuestion; players: Player[] }) {
  const counts = q.options.map((_, i) => players.filter((p) => p.choice === i).length)
  const most = Math.max(1, ...counts)
  return (
    <div className="mx-auto my-8 flex h-44 w-full max-w-2xl items-end justify-center gap-4" aria-label="How the class answered">
      {counts.map((n, i) => (
        <div key={i} className="flex h-full w-20 flex-col items-center justify-end gap-1">
          <span className="text-2xl font-black">{n}</span>
          <motion.div initial={{ height: 0 }} animate={{ height: `${(n / most) * 100}%` }} className={`w-full rounded-t-2xl ${ANSWER_STYLES[i].cls.split(' ')[0]} ${i === q.answerIndex ? '' : 'opacity-50'}`} style={{ minHeight: 6 }} />
          {(() => {
            const Icon = ANSWER_STYLES[i].icon
            return <Icon aria-label={ANSWER_STYLES[i].name} className="h-6 w-6" strokeWidth={3} />
          })()}
        </div>
      ))}
    </div>
  )
}

function Podium({ ranked, onAgain }: { ranked: Player[]; onAgain: () => void }) {
  const places = [
    { p: ranked[1], h: 'h-40', medal: '🥈', place: 2, delay: 0.4 },
    { p: ranked[0], h: 'h-56', medal: '🥇', place: 1, delay: 0.9 },
    { p: ranked[2], h: 'h-28', medal: '🥉', place: 3, delay: 0 },
  ].filter((x) => x.p)
  return (
    <section className="flex flex-1 flex-col items-center py-8">
      <Confetti pieces={60} />
      <h2 className="text-4xl font-black sm:text-5xl">வெற்றியாளர்கள்! 🏆</h2>
      <div className="mt-10 flex w-full max-w-3xl items-end justify-center gap-3 sm:gap-6">
        {places.map(({ p, h, medal, place, delay }) => (
          <motion.div key={p.name} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay, type: 'spring', stiffness: 120 }} className="flex flex-1 flex-col items-center">
            <span className="text-5xl" aria-hidden>
              {medal}
            </span>
            <span className="mt-1 max-w-full truncate text-2xl font-black">{p.name}</span>
            <span className="font-bold tabular-nums text-white/80">{p.score}</span>
            <div className={`mt-2 grid w-full place-items-center rounded-t-3xl bg-white/90 text-5xl font-black text-indigo-900 ${h}`} aria-label={`Place ${place}`}>
              {place}
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button tone="amber" size="lg" onClick={onAgain}>
          Play again
        </Button>
        <Link href="/gr-classic/teacher" className="inline-flex items-center rounded-2xl bg-white/10 px-6 py-4 text-lg font-bold hover:bg-white/20">
          Done
        </Link>
      </div>
    </section>
  )
}
