'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiArchive, FiBookOpen, FiCopy, FiEdit2, FiPlay, FiPlusCircle, FiRadio, FiSend } from 'react-icons/fi'
import { dueLabel, formatDue, isPast } from '@/lib/grClassic/format'
import type { AssignmentSummary, GameSummary } from '@/lib/grClassic/types'
import { Button, ButtonLink, Card, Pill, Shell, TYPE_META, buttonClass } from '../ui'
import { grcApi } from './api'

type Tab = 'games' | 'assignments'

export function TeacherDashboard({ games: initialGames, assignments, pick, tab: initialTab = 'games' }: { games: GameSummary[]; assignments: AssignmentSummary[]; pick?: 'host' | 'assign'; tab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [games, setGames] = useState<GameSummary[]>(initialGames)
  const [notice, setNotice] = useState('')

  const duplicate = async (g: GameSummary) => {
    const res = await grcApi<{ game: GameSummary }>(`/games/${g.id}/duplicate`, { method: 'POST' })
    if (!res.ok) return setNotice(res.error)
    setGames((gs) => [res.data.game, ...gs])
    setNotice(`Made a copy: “${res.data.game.title}”.`)
  }
  const archive = async (g: GameSummary) => {
    const res = await grcApi(`/games/${g.id}`, { method: 'DELETE' })
    if (!res.ok) return setNotice(res.error)
    setGames((gs) => gs.filter((x) => x.id !== g.id))
    setNotice(`“${g.title}” archived.`)
  }

  return (
    <Shell back={{ href: '/gr-classic', label: 'Home' }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">வணக்கம்! 👋</h1>
          <p className="font-semibold text-slate-600">Pick a game to play, host or assign — or make a new one.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/gr-classic/teacher/library" tone="plain" size="lg">
            <FiBookOpen aria-hidden /> Question Library
          </ButtonLink>
          <ButtonLink href="/gr-classic/teacher/create" size="lg">
            <FiPlusCircle aria-hidden /> Create Game
          </ButtonLink>
        </div>
      </div>

      <div role="tablist" aria-label="Teacher views" className="mt-6 inline-flex rounded-2xl bg-white p-1 ring-1 ring-slate-200">
        {(['games', 'assignments'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-extrabold transition sm:text-base ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {t === 'games' ? `My Games (${games.length})` : `Assignments (${assignments.length})`}
          </button>
        ))}
      </div>

      {tab === 'games' && (
        <>
          {pick && (
            <p className="mt-5 rounded-2xl bg-indigo-50 px-4 py-3 font-bold text-indigo-900 ring-1 ring-indigo-200">
              {pick === 'host' ? '📺 Choose a game, then press Host to start a live game.' : '📬 Choose a game, then press Assign to send it to a class.'}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white">
              {notice}
              <button type="button" className="text-sm font-bold text-white/80 hover:text-white" onClick={() => setNotice('')}>
                Dismiss
              </button>
            </p>
          )}
          {games.length === 0 && (
            <Card className="mt-5 p-8 text-center">
              <p className="text-5xl" aria-hidden>
                🎲
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">No games yet</h2>
              <p className="mt-1 font-semibold text-slate-600">Make your first game in three steps: choose a type, add questions, save.</p>
              <ButtonLink href="/gr-classic/teacher/create" className="mt-5">
                <FiPlusCircle aria-hidden /> Create Game
              </ButtonLink>
            </Card>
          )}
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => (
              <li key={g.id}>
                <GameCard game={g} pick={pick} onDuplicate={() => duplicate(g)} onArchive={() => archive(g)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'assignments' && <AssignmentList assignments={assignments} />}
    </Shell>
  )
}

function GameCard({ game, pick, onDuplicate, onArchive }: { game: GameSummary; pick?: 'host' | 'assign'; onDuplicate: () => void; onArchive: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const m = TYPE_META[game.type]
  const Icon = m.icon
  const glow = (p: 'host' | 'assign') => (pick === p ? 'ring-4 ring-offset-2 ring-amber-300 animate-pulse' : '')
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className={`flex items-center gap-2 px-5 py-3 text-white ${m.band}`}>
        <Icon aria-hidden className="h-5 w-5" />
        <span className="text-sm font-extrabold">{m.label}</span>
        <span className="ml-auto text-sm font-bold opacity-90">{m.ta}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-xl font-extrabold leading-snug text-slate-900">{game.title}</h3>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {game.questionCount} {game.type === 'match' ? 'boards' : 'questions'}
          {game.category && ` · ${game.category}`}
        </p>
        <div className="mt-auto grid grid-cols-3 gap-2 pt-5">
          <Link prefetch={false} href={`/gr-classic/host/${game.id}`} className={`${buttonClass('indigo', 'sm')} ${glow('host')}`}>
            <FiRadio aria-hidden /> Host
          </Link>
          <Link href={`/gr-classic/teacher/assign/${game.id}`} className={`${buttonClass('teal', 'sm')} ${glow('assign')}`}>
            <FiSend aria-hidden /> Assign
          </Link>
          <Link href={`/gr-classic/play/${game.id}?mode=preview`} className={buttonClass('plain', 'sm')}>
            <FiPlay aria-hidden /> Play
          </Link>
        </div>
        <div className="mt-3 flex justify-center gap-1 border-t border-slate-100 pt-3 text-sm">
          <Link href={`/gr-classic/teacher/create?edit=${game.id}`} className={buttonClass('ghost', 'sm')}>
            <FiEdit2 aria-hidden /> Edit
          </Link>
          <Button tone="ghost" size="sm" onClick={onDuplicate}>
            <FiCopy aria-hidden /> Duplicate
          </Button>
          {confirming ? (
            <span className="flex items-center gap-1" role="group" aria-label="Confirm archive">
              <Button tone="primary" size="sm" onClick={onArchive}>
                Archive
              </Button>
              <Button tone="plain" size="sm" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button tone="ghost" size="sm" onClick={() => setConfirming(true)}>
              <FiArchive aria-hidden /> Archive
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function AssignmentList({ assignments }: { assignments: AssignmentSummary[] }) {
  if (!assignments.length) {
    return (
      <Card className="mt-5 p-8 text-center">
        <p className="text-5xl" aria-hidden>
          📬
        </p>
        <h2 className="mt-2 text-2xl font-black text-slate-900">No assignments yet</h2>
        <p className="mt-1 font-semibold text-slate-600">Press Assign on any game to send it to a class as homework.</p>
      </Card>
    )
  }
  return (
    <ul className="mt-5 space-y-3">
      {assignments.map((a) => {
        const past = isPast(a.dueAt)
        return (
          <li key={a.id}>
            <Link href={`/gr-classic/teacher/assignments/${a.id}`} className="block rounded-3xl">
              <Card className="flex flex-col gap-3 p-5 transition hover:-translate-y-0.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold text-slate-900">{a.title}</p>
                  <p className="text-sm font-semibold text-slate-500">
                    {a.classNames.join(', ')} · Due {formatDue(a.dueAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.status === 'closed' ? <Pill>Closed</Pill> : past ? <Pill tone="red">{dueLabel(a.dueAt)}</Pill> : <Pill tone="green">Open · {dueLabel(a.dueAt)}</Pill>}
                  <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-extrabold text-slate-800">
                    {a.submitted}/{a.students} submitted
                  </span>
                </div>
              </Card>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
