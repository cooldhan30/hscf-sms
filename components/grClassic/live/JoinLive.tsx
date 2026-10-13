'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FiCheckCircle, FiXCircle } from 'react-icons/fi'
import { livePoints } from '@/lib/grClassic/scoring'
import { SAMPLE_LIVE_PIN, SAMPLE_STUDENT, gameById } from '@/lib/grClassic/sampleData'
import type { ChoiceQuestion } from '@/lib/grClassic/types'
import { AnswerButton } from '../games/AnswerButton'
import { Button, ButtonLink, Card, PrototypeNote, Shell } from '../ui'

type Phase = 'pin' | 'waiting' | 'question' | 'locked' | 'result' | 'final'

// Student side of a live game. Login is required, so there is no nickname
// step -- students play under their own first name. Prototype: the game
// and the teacher's actions are simulated.
export function JoinLive() {
  const game = gameById('g-uyir-quiz')!
  const questions = game.questions as ChoiceQuestion[]
  const [phase, setPhase] = useState<Phase>('pin')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [qi, setQi] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [gained, setGained] = useState(0)
  const [score, setScore] = useState(0)
  const [left, setLeft] = useState(game.liveSeconds)
  const q = questions[qi]

  const join = () => {
    const digits = pin.replace(/\D/g, '')
    if (digits.length !== 6) return setError('A game PIN has 6 numbers.')
    if (digits !== SAMPLE_LIVE_PIN) return setError("We couldn't find a game with that PIN. Check the big screen and try again.")
    setError('')
    setPhase('waiting')
  }

  const startQuestion = (i: number) => {
    setQi(i)
    setChoice(null)
    setStartedAt(Date.now())
    setLeft(game.liveSeconds)
    setPhase('question')
  }

  const answer = (i: number) => {
    setChoice(i)
    const pts = livePoints(i === q.answerIndex, Date.now() - startedAt, game.liveSeconds * 1000)
    setGained(pts)
    setScore((s) => s + pts)
    setPhase('locked')
  }

  useEffect(() => {
    if (phase === 'locked') {
      const t = setTimeout(() => setPhase('result'), 1500)
      return () => clearTimeout(t)
    }
    if (phase === 'question') {
      const t = setInterval(() => {
        const l = Math.max(0, Math.ceil(game.liveSeconds - (Date.now() - startedAt) / 1000))
        setLeft(l)
        if (l === 0) {
          setGained(0)
          setPhase('result')
        }
      }, 250)
      return () => clearInterval(t)
    }
  }, [phase, startedAt, game.liveSeconds])

  if (phase === 'pin') {
    return (
      <Shell back={{ href: '/gr-classic/student', label: 'Back' }} width="max-w-md">
        <Card className="mt-4 p-6 text-center sm:p-8">
          <h1 className="text-3xl font-black text-slate-900">Join a live game</h1>
          <p className="mt-1 font-semibold text-slate-500">Type the PIN from the big screen</p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              join()
            }}
          >
            <label htmlFor="grc-pin" className="sr-only">
              Game PIN
            </label>
            <input
              id="grc-pin"
              inputMode="numeric"
              autoComplete="off"
              maxLength={7}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^\d ]/g, ''))}
              placeholder="Game PIN"
              className="w-full rounded-2xl border-0 bg-slate-50 px-4 py-4 text-center font-sans text-4xl font-black tracking-[0.3em] text-slate-900 ring-2 ring-slate-200 placeholder:text-2xl placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500"
              aria-describedby="grc-pin-error"
            />
            <p id="grc-pin-error" role="alert" className="min-h-[1.5rem] text-sm font-bold text-rose-700">
              {error}
            </p>
            <Button tone="indigo" size="lg" className="w-full" type="submit">
              Join ▶
            </Button>
          </form>
          <p className="mt-4 text-sm font-semibold text-slate-500">
            Playing as <span className="font-extrabold text-slate-800">{SAMPLE_STUDENT.name}</span>
          </p>
          <PrototypeNote>try PIN {SAMPLE_LIVE_PIN}.</PrototypeNote>
        </Card>
      </Shell>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-900 font-tamil text-white">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-4">
        <header className="flex items-center justify-between font-extrabold">
          <span>{SAMPLE_STUDENT.name}</span>
          <span className="rounded-xl bg-white/10 px-3 py-1 tabular-nums">{score} pts</span>
        </header>

        {phase === 'waiting' && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <motion.p animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} className="text-7xl" aria-hidden>
              🎉
            </motion.p>
            <h1 className="mt-4 text-3xl font-black">You&apos;re in!</h1>
            <p className="mt-2 text-lg font-bold text-white/80">See your name on the big screen? Get ready…</p>
            <p className="mt-6 animate-pulse font-bold text-white/60">Waiting for your teacher to start</p>
            <Button tone="plain" size="sm" className="mt-10" onClick={() => startQuestion(0)}>
              Demo: teacher starts the game
            </Button>
          </section>
        )}

        {phase === 'question' && (
          <section className="flex flex-1 flex-col py-4">
            <div className="flex items-center justify-between font-bold text-white/80">
              <span>
                {qi + 1} / {questions.length}
              </span>
              <span role="timer" aria-label={`${left} seconds left`} className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-xl font-black text-white">
                {left}
              </span>
            </div>
            <h1 className="mt-4 text-center text-2xl font-black sm:text-3xl">{q.prompt}</h1>
            <div className="mt-6 grid flex-1 content-center gap-4">
              {q.options.map((o, i) => (
                <AnswerButton key={i} index={i} text={o} size="xl" onClick={() => answer(i)} />
              ))}
            </div>
          </section>
        )}

        {phase === 'locked' && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-6xl" aria-hidden>
              🔒
            </p>
            <h1 className="mt-4 text-3xl font-black">Answer locked in!</h1>
            <p className="mt-2 font-bold text-white/70">Waiting for everyone else…</p>
          </section>
        )}

        {phase === 'result' && (
          <section className="flex flex-1 flex-col items-center justify-center text-center" role="status">
            {choice === q.answerIndex ? <FiCheckCircle aria-hidden className="h-24 w-24 text-emerald-400" /> : <FiXCircle aria-hidden className="h-24 w-24 text-rose-400" />}
            <h1 className="mt-4 text-4xl font-black">{choice === null ? "Time's up!" : choice === q.answerIndex ? 'சரி! Correct!' : 'Not this time'}</h1>
            {choice !== q.answerIndex && <p className="mt-2 text-xl font-bold">Answer: {q.options[q.answerIndex]}</p>}
            {gained > 0 && <p className="mt-3 rounded-2xl bg-white/15 px-5 py-2 text-3xl font-black text-amber-300">+{gained}</p>}
            <Button tone="amber" size="lg" className="mt-10" onClick={() => (qi + 1 < questions.length ? startQuestion(qi + 1) : setPhase('final'))}>
              {qi + 1 < questions.length ? 'Demo: next question ▶' : 'Demo: game over'}
            </Button>
          </section>
        )}

        {phase === 'final' && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-7xl" aria-hidden>
              🥉
            </p>
            <h1 className="mt-4 text-4xl font-black">You came 3rd!</h1>
            <p className="mt-2 text-2xl font-extrabold tabular-nums text-amber-300">{score} points</p>
            <p className="mt-2 font-bold text-white/80">அருமை! Great playing.</p>
            <ButtonLink href="/gr-classic/student" tone="plain" size="lg" className="mt-10">
              Back to GameRoom
            </ButtonLink>
          </section>
        )}
      </div>
    </div>
  )
}
