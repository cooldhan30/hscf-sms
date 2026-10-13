'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiArchive, FiCopy, FiEdit2, FiPlay, FiPlusCircle, FiRadio, FiSend } from 'react-icons/fi'
import { dueLabel, formatDue, isPast } from '@/lib/grClassic/format'
import { ASSIGNMENTS, GAMES, className, gameById, resultsFor } from '@/lib/grClassic/sampleData'
import type { Game } from '@/lib/grClassic/types'
import { Button, ButtonLink, Card, Pill, PrototypeNote, Shell, TYPE_META, buttonClass } from '../ui'

type Tab = 'games' | 'assignments'

export function TeacherDashboard({ pick, tab: initialTab = 'games' }: { pick?: 'host' | 'assign'; tab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [games, setGames] = useState<Game[]>(GAMES)
  const [archived, setArchived] = useState<Game | null>(null)

  const duplicate = (g: Game) => setGames((gs) => [{ ...g, id: `${g.id}-copy-${gs.length}`, title: `${g.title} (copy)` }, ...gs])
  const archive = (g: Game) => {
    setGames((gs) => gs.filter((x) => x.id !== g.id))
    setArchived(g)
  }

  return (
    <Shell back={{ href: '/gr-classic', label: 'Home' }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">வணக்கம்! 👋</h1>
          <p className="font-semibold text-slate-600">Pick a game to play, host or assign — or make a new one.</p>
        </div>
        <ButtonLink href="/gr-classic/teacher/create" size="lg">
          <FiPlusCircle aria-hidden /> Create Game
        </ButtonLink>
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
            {t === 'games' ? `My Games (${games.length})` : `Assignments (${ASSIGNMENTS.length})`}
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
          {archived && (
            <div role="status" className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white">
              <span className="font-semibold">“{archived.title}” archived.</span>
              <Button
                tone="plain"
                size="sm"
                onClick={() => {
                  setGames((gs) => [archived, ...gs])
                  setArchived(null)
                }}
              >
                Undo
              </Button>
            </div>
          )}
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => (
              <li key={g.id}>
                <GameCard game={g} pick={pick} onDuplicate={() => duplicate(g)} onArchive={() => archive(g)} />
              </li>
            ))}
          </ul>
          <PrototypeNote>Duplicate and Archive only change this page; nothing is saved yet.</PrototypeNote>
        </>
      )}

      {tab === 'assignments' && <AssignmentList />}
    </Shell>
  )
}

function GameCard({ game, pick, onDuplicate, onArchive }: { game: Game; pick?: 'host' | 'assign'; onDuplicate: () => void; onArchive: () => void }) {
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
          {game.questions.length} {game.type === 'match' ? 'boards' : 'questions'} · {game.category}
        </p>
        <div className="mt-auto grid grid-cols-3 gap-2 pt-5">
          <Link href={`/gr-classic/host/${game.id}`} className={`${buttonClass('indigo', 'sm')} ${glow('host')}`}>
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
          <Button tone="ghost" size="sm" onClick={onArchive}>
            <FiArchive aria-hidden /> Archive
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AssignmentList() {
  return (
    <ul className="mt-5 space-y-3">
      {ASSIGNMENTS.map((a) => {
        const g = gameById(a.gameId)!
        const rs = resultsFor(a)
        const submitted = rs.filter((r) => r.status === 'submitted').length
        const past = isPast(a.dueAt)
        return (
          <li key={a.id}>
            <Link href={`/gr-classic/teacher/assignments/${a.id}`} className="block rounded-3xl">
              <Card className="flex flex-col gap-3 p-5 transition hover:-translate-y-0.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold text-slate-900">{g.title}</p>
                  <p className="text-sm font-semibold text-slate-500">
                    {a.classIds.map(className).join(', ')} · Due {formatDue(a.dueAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.status === 'closed' ? <Pill>Closed</Pill> : past ? <Pill tone="red">{dueLabel(a.dueAt)}</Pill> : <Pill tone="green">Open · {dueLabel(a.dueAt)}</Pill>}
                  <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-extrabold text-slate-800">
                    {submitted}/{rs.length} submitted
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
