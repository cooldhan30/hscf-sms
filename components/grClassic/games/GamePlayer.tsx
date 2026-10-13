'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { FiCheckCircle, FiX, FiXCircle } from 'react-icons/fi'
import { formatDate } from '@/lib/grClassic/format'
import { encouragement, starsFor, totals } from '@/lib/grClassic/scoring'
import { shuffle } from '@/lib/grClassic/shuffle'
import { localSession, toPlayQuestion, type PlayQuestion, type PlaySession } from '@/lib/grClassic/play'
import type { GameType, Question, QuestionResult } from '@/lib/grClassic/types'
import { remoteSession } from './remoteSession'
import { Button, ButtonLink, Card, Pill, ProgressBar, TypeChip } from '../ui'
import { Confetti } from './Confetti'
import { MatchBoard } from './MatchBoard'
import { QuizQuestion } from './QuizQuestion'
import { WordBuilder } from './WordBuilder'

export type PlayMode = 'practice' | 'assignment' | 'preview'

export interface AssignmentContext {
  attemptsLeftAfter: number | null // null = unlimited
  showScore: boolean
  randomize: boolean
  dueAt: string
}

type Exit = { href: string } | { onClick: () => void }

// Where answers are checked:
//   local  -- the full questions are already in this browser (a teacher
//             previewing an unsaved draft, or the Phase 1 sample games)
//   remote -- the browser only has answer-free PlayQuestions; every check
//             and hint goes to the server at `base` (e.g. /games/<id>)
export type PlaySource = { source: 'local'; questions: Question[] } | { source: 'remote'; base: string; questions: PlayQuestion[] }

export interface GameInfo {
  title: string
  type: GameType
}

// Runs one game from first question to results, the same way for every
// game type. Practice and preview give feedback after each question;
// an assignment only says "saved" and ends with Finish & Submit.
export function GamePlayer({ game, play, mode, assignment, exit }: { game: GameInfo; play: PlaySource; mode: PlayMode; assignment?: AssignmentContext; exit: Exit }) {
  // Shuffling happens only in the browser (no server/client mismatch).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="min-h-[60vh]" />
  return <Player game={game} play={play} mode={mode} assignment={assignment} exit={exit} />
}

function Player({ game, play, mode, assignment, exit }: { game: GameInfo; play: PlaySource; mode: PlayMode; assignment?: AssignmentContext; exit: Exit }) {
  const graded = mode === 'assignment'
  const { session, ordered } = useMemo((): { session: PlaySession; ordered: PlayQuestion[] } => {
    const list = play.source === 'local' ? play.questions.map(toPlayQuestion) : play.questions
    const session = play.source === 'local' ? localSession(play.questions, !graded) : remoteSession(play.base)
    return { session, ordered: assignment?.randomize ? shuffle(list) : list }
  }, [play, assignment, graded])
  const questions = ordered
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [pending, setPending] = useState<QuestionResult | null>(null)
  const [phase, setPhase] = useState<'play' | 'confirm' | 'submitting' | 'done'>('play')
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const q = questions[index]
  const last = index === questions.length - 1

  const next = () => {
    if (!pending) return
    setResults((r) => [...r, pending])
    setPending(null)
    if (!last) setIndex((i) => i + 1)
    else setPhase(graded ? 'confirm' : 'done')
  }

  const submit = () => {
    // Prototype: stands in for the server call. The real version shows
    // success only after the server confirms the submission is stored.
    setPhase('submitting')
    setTimeout(() => {
      setSubmittedAt(new Date().toISOString())
      setPhase('done')
    }, 700)
  }

  const restart = () => {
    setIndex(0)
    setResults([])
    setPending(null)
    setPhase('play')
    setRound((n) => n + 1)
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
      <div className="flex items-center gap-3 py-4">
        <ExitButton exit={exit} label={graded && phase === 'play' ? 'Save & exit' : 'Exit'} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-slate-900 sm:text-base">{game.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <TypeChip type={game.type} />
            <Pill tone={graded ? 'blue' : mode === 'preview' ? 'amber' : 'green'}>{graded ? 'Assignment' : mode === 'preview' ? 'Teacher preview' : 'Practice'}</Pill>
          </div>
        </div>
        {phase === 'play' && (
          <span className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-sm font-extrabold text-slate-700 ring-1 ring-slate-200">
            {index + 1} / {questions.length}
          </span>
        )}
      </div>

      {phase === 'play' && (
        <>
          <ProgressBar value={index + (pending ? 1 : 0)} max={questions.length} label="Progress" />
          <Card className="mt-5 p-5 sm:p-8">
            <QuestionView key={`${round}-${q.id}`} question={q} session={session} reveal={!graded} hints={mode === 'practice'} onAnswered={setPending} />
          </Card>
          <AnimatePresence>
            {pending && (
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="sticky bottom-3 z-30 mt-5">
                <Feedback result={pending} graded={graded} explanation={pending.explanation} onNext={next} last={last} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {(phase === 'confirm' || phase === 'submitting') && (
        <Card className="mx-auto mt-8 max-w-xl p-8 text-center">
          <p className="text-5xl" aria-hidden>
            📝
          </p>
          <h2 className="mt-3 text-2xl font-extrabold text-slate-900">You answered all {questions.length} questions!</h2>
          <p className="mt-2 text-slate-600">Ready to hand it in? After you submit, this attempt can&apos;t be changed.</p>
          <Button tone="teal" size="lg" className="mt-6 w-full" onClick={submit} disabled={phase === 'submitting'}>
            {phase === 'submitting' ? 'Submitting…' : 'Finish & Submit'}
          </Button>
        </Card>
      )}

      {phase === 'done' && graded && submittedAt && assignment && <Submitted results={results} assignment={assignment} submittedAt={submittedAt} exit={exit} onRetry={restart} />}
      {phase === 'done' && !graded && <Results results={results} onAgain={restart} exit={exit} />}
    </div>
  )
}

function QuestionView({ question, session, reveal, hints, onAnswered }: { question: PlayQuestion; session: PlaySession; reveal: boolean; hints: boolean; onAnswered: (r: QuestionResult) => void }) {
  if (question.kind === 'choice') return <QuizQuestion question={question} session={session} reveal={reveal} hints={hints} onAnswered={onAnswered} />
  if (question.kind === 'match') return <MatchBoard question={question} session={session} hints={hints} onAnswered={onAnswered} />
  return <WordBuilder question={question} session={session} reveal={reveal} hints={hints} onAnswered={onAnswered} />
}

function Feedback({ result, graded, explanation, onNext, last }: { result: QuestionResult; graded: boolean; explanation?: string; onNext: () => void; last: boolean }) {
  const all = result.correctUnits === result.totalUnits
  const tone = graded ? 'bg-slate-900 text-white' : all ? 'bg-emerald-600 text-white' : 'bg-rose-700 text-white'
  return (
    <div role="status" aria-live="polite" className={`flex flex-col gap-3 rounded-3xl p-4 shadow-xl sm:flex-row sm:items-center sm:p-5 ${tone}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {graded ? <FiCheckCircle aria-hidden className="mt-0.5 h-7 w-7 shrink-0" /> : all ? <FiCheckCircle aria-hidden className="mt-0.5 h-7 w-7 shrink-0" /> : <FiXCircle aria-hidden className="mt-0.5 h-7 w-7 shrink-0" />}
        <div className="min-w-0">
          {graded ? (
            <p className="text-lg font-extrabold">Answer saved</p>
          ) : (
            <>
              <p className="text-lg font-extrabold">{all ? 'சரி! Correct!' : result.totalUnits > 1 ? `${result.correctUnits} of ${result.totalUnits} right first time` : 'Not this time'}</p>
              {!all && result.totalUnits === 1 && result.expected && <p className="font-semibold">Answer: {result.expected}</p>}
              {explanation && <p className="mt-0.5 text-sm opacity-90">{explanation}</p>}
            </>
          )}
        </div>
      </div>
      <Button tone="plain" size="lg" onClick={onNext} autoFocus>
        {last ? (graded ? 'Finish' : 'See my score') : 'Next →'}
      </Button>
    </div>
  )
}

function Stars({ n }: { n: number }) {
  return (
    <p className="text-5xl tracking-widest" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? '' : 'opacity-20 grayscale'}>
          ⭐
        </span>
      ))}
    </p>
  )
}

function Results({ results, onAgain, exit }: { results: QuestionResult[]; onAgain: () => void; exit: Exit }) {
  const t = totals(results)
  const msg = encouragement(t.percent)
  return (
    <div className="mt-6">
      {t.percent >= 70 && <Confetti />}
      <Card className="p-8 text-center">
        <Stars n={starsFor(t.percent)} />
        <h2 className="mt-3 text-3xl font-extrabold text-slate-900">{msg.ta}</h2>
        <p className="font-semibold text-slate-600">{msg.en}</p>
        <p className="mt-4 text-6xl font-black text-rose-600">{t.percent}%</p>
        <p className="font-bold text-slate-700">
          {t.correct} of {t.total} right
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button tone="primary" size="lg" onClick={onAgain}>
            Play again
          </Button>
          <ExitButton exit={exit} label="Done" big />
        </div>
      </Card>
      <ReviewList results={results} showAnswers />
    </div>
  )
}

function Submitted({ results, assignment, submittedAt, exit, onRetry }: { results: QuestionResult[]; assignment: AssignmentContext; submittedAt: string; exit: Exit; onRetry: () => void }) {
  const t = totals(results)
  const msg = encouragement(t.percent)
  const left = assignment.attemptsLeftAfter
  return (
    <div className="mt-6">
      <Confetti />
      <Card className="mx-auto max-w-xl p-8 text-center">
        <FiCheckCircle aria-hidden className="mx-auto h-16 w-16 text-emerald-500" />
        <h2 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl">Assignment Submitted Successfully!</h2>
        <p className="font-semibold text-slate-600">வேலை வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டது</p>
        {assignment.showScore && (
          <>
            <p className="mt-5 text-6xl font-black text-teal-600">{t.percent}%</p>
            <p className="font-bold text-slate-700">
              {t.correct} of {t.total} right · {msg.en}
            </p>
          </>
        )}
        <dl className="mt-6 grid grid-cols-2 gap-3 text-left">
          <div className="rounded-2xl bg-slate-50 p-3">
            <dt className="text-xs font-bold uppercase text-slate-500">Attempts left</dt>
            <dd className="text-lg font-extrabold text-slate-900">{left === null ? 'Unlimited' : left}</dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <dt className="text-xs font-bold uppercase text-slate-500">Submitted</dt>
            <dd className="text-lg font-extrabold text-slate-900">{formatDate(submittedAt)}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ExitButton exit={exit} label="My Assignments" big />
          {(left === null || left > 0) && (
            <Button tone="plain" size="lg" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
        <p className="mt-4 text-sm text-slate-500">Your best score counts. Correct answers appear after the due date.</p>
      </Card>
    </div>
  )
}

export function ReviewList({ results, showAnswers }: { results: QuestionResult[]; showAnswers: boolean }) {
  return (
    <Card className="mt-6 p-5 sm:p-6">
      <h3 className="text-lg font-extrabold text-slate-900">Question by question</h3>
      <ol className="mt-3 divide-y divide-slate-100">
        {results.map((r, i) => {
          const ok = r.correctUnits === r.totalUnits
          return (
            <li key={r.questionId + i} className="flex items-start gap-3 py-3">
              {ok ? <FiCheckCircle aria-label="Right" className="mt-1 h-5 w-5 shrink-0 text-emerald-600" /> : <FiXCircle aria-label="Missed" className="mt-1 h-5 w-5 shrink-0 text-rose-600" />}
              <div className="min-w-0">
                <p className="font-bold text-slate-900">
                  {i + 1}. {r.prompt}
                </p>
                <p className="text-sm text-slate-600">
                  {r.totalUnits > 1 && `${r.correctUnits}/${r.totalUnits} pairs · `}
                  Your answer: <span className="font-semibold">{r.given || '—'}</span>
                </p>
                {showAnswers && !ok && r.expected && <p className="text-sm text-emerald-700">Right answer: {r.expected}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function ExitButton({ exit, label, big }: { exit: Exit; label: string; big?: boolean }) {
  if (big) {
    return 'href' in exit ? (
      <ButtonLink href={exit.href} tone="plain" size="lg">
        {label}
      </ButtonLink>
    ) : (
      <Button tone="plain" size="lg" onClick={exit.onClick}>
        {label}
      </Button>
    )
  }
  const cls = 'flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
  return 'href' in exit ? (
    <Link href={exit.href} className={cls}>
      <FiX aria-hidden /> {label}
    </Link>
  ) : (
    <button type="button" onClick={exit.onClick} className={cls}>
      <FiX aria-hidden /> {label}
    </button>
  )
}
