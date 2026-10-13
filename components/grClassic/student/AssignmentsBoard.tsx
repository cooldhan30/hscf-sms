'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiClock } from 'react-icons/fi'
import { dueLabel, formatDue, isPast } from '@/lib/grClassic/format'
import { isUuid } from '@/lib/grClassic/validateQuestion'
import type { StudentAssignment, StudentAssignmentStatus } from '@/lib/grClassic/types'
import { Card, Pill, Shell, TypeChip, buttonClass, countLabel } from '../ui'

const TABS: { key: StudentAssignmentStatus; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'overdue', label: 'Overdue' },
]

const EMPTY: Record<StudentAssignmentStatus, string> = {
  todo: 'Nothing new to do. 🎉',
  'in-progress': 'No games half-finished.',
  submitted: 'Nothing submitted yet.',
  overdue: 'Nothing overdue. Well done!',
}

// Students only see assignments for classes they're enrolled in -- no PIN needed.
export function AssignmentsBoard({ items }: { items: StudentAssignment[] }) {
  const [tab, setTab] = useState<StudentAssignmentStatus>(TABS.find((t) => items.some((a) => a.status === t.key))?.key ?? 'todo')
  const shown = items.filter((a) => a.status === tab)
  return (
    <Shell back={{ href: '/gr-classic/student', label: 'Back' }} width="max-w-4xl">
      <h1 className="text-3xl font-black text-slate-900">My Assignments</h1>
      <p className="font-semibold text-slate-600">என் பணிகள்</p>
      <div role="tablist" aria-label="Assignment status" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map((t) => {
          const n = items.filter((a) => a.status === t.key).length
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left font-extrabold ring-2 transition ${tab === t.key ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300'}`}
            >
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${tab === t.key ? 'bg-white text-slate-900' : t.key === 'overdue' && n ? 'bg-rose-100 text-rose-800' : 'bg-slate-100'}`}>{n}</span>
            </button>
          )
        })}
      </div>
      <ul className="mt-5 space-y-4" role="tabpanel">
        {shown.length === 0 && <li className="rounded-3xl border-2 border-dashed border-slate-300 p-8 text-center font-bold text-slate-500">{items.length === 0 && tab === 'todo' ? 'Your teacher hasn’t given you any GameRoom Classic assignments yet.' : EMPTY[tab]}</li>}
        {shown.map((a) => (
          <li key={a.assignment.id}>
            <AssignmentCard a={a} />
          </li>
        ))}
      </ul>
    </Shell>
  )
}

export function playHref(a: StudentAssignment): string {
  // Real assignments are played through the server; the Phase 1 samples locally.
  return isUuid(a.assignment.id) ? `/gr-classic/assignment/${a.assignment.id}` : `/gr-classic/play/${a.assignment.gameId}?mode=assignment&a=${a.assignment.id}`
}

export function AssignmentCard({ a }: { a: StudentAssignment }) {
  const { assignment } = a
  const left = a.attemptLimit === null ? null : Math.max(0, a.attemptLimit - a.attemptsUsed)
  const open = assignment.status === 'open' && (!isPast(assignment.dueAt) || assignment.settings.allowLate)
  const due = a.status === 'overdue' ? <Pill tone="red">{assignment.status === 'closed' ? 'Closed' : dueLabel(assignment.dueAt)}</Pill> : <Pill tone={a.status === 'submitted' ? 'green' : 'amber'}>{a.status === 'submitted' ? 'Submitted' : dueLabel(assignment.dueAt)}</Pill>

  let action
  if (a.status === 'submitted') action = <Link href={`/gr-classic/student/assignments/${assignment.id}`} className={buttonClass('plain')}>Review</Link>
  else if (a.status === 'in-progress') action = <Link href={playHref(a)} className={buttonClass('teal')}>Continue</Link>
  else if (!open) action = <span className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-500">Closed — ask your teacher</span>
  else action = <Link href={playHref(a)} className={buttonClass(a.status === 'overdue' ? 'amber' : 'primary')}>{a.status === 'overdue' ? 'Start (late)' : 'Start'}</Link>

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <TypeChip type={assignment.type} />
          {due}
        </div>
        <p className="mt-2 text-xl font-extrabold leading-snug text-slate-900">{assignment.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-500">
          <span>{a.className}</span>
          <span className="inline-flex items-center gap-1">
            <FiClock aria-hidden /> Due {formatDue(assignment.dueAt)}
          </span>
          <span>
            {countLabel(assignment.questionCount, assignment.type)}
          </span>
          {assignment.settings.timerMinutes && <span>⏱ {assignment.settings.timerMinutes} min</span>}
          <span>{left === null ? 'Unlimited attempts' : `${left} attempt${left === 1 ? '' : 's'} left`}</span>
          {a.bestPercent !== null && <span className="font-extrabold text-teal-700">Score: {a.bestPercent}%</span>}
        </p>
      </div>
      <div className="flex shrink-0 flex-col">{action}</div>
    </Card>
  )
}
