'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiClock } from 'react-icons/fi'
import { dueLabel, formatDue } from '@/lib/grClassic/format'
import { studentAssignments } from '@/lib/grClassic/sampleData'
import type { StudentAssignment, StudentAssignmentStatus } from '@/lib/grClassic/types'
import { Card, Pill, Shell, TypeChip, buttonClass } from '../ui'

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
export function AssignmentsBoard() {
  const all = studentAssignments()
  const [tab, setTab] = useState<StudentAssignmentStatus>(TABS.find((t) => all.some((a) => a.status === t.key))?.key ?? 'todo')
  const shown = all.filter((a) => a.status === tab)
  return (
    <Shell back={{ href: '/gr-classic/student', label: 'Back' }} width="max-w-4xl">
      <h1 className="text-3xl font-black text-slate-900">My Assignments</h1>
      <p className="font-semibold text-slate-600">என் பணிகள்</p>
      <div role="tablist" aria-label="Assignment status" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map((t) => {
          const n = all.filter((a) => a.status === t.key).length
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
        {shown.length === 0 && <li className="rounded-3xl border-2 border-dashed border-slate-300 p-8 text-center font-bold text-slate-500">{EMPTY[tab]}</li>}
        {shown.map((a) => (
          <li key={a.assignment.id}>
            <AssignmentCard a={a} />
          </li>
        ))}
      </ul>
    </Shell>
  )
}

export function AssignmentCard({ a }: { a: StudentAssignment }) {
  const { assignment, game } = a
  const max = assignment.settings.maxAttempts
  const left = max === null ? null : Math.max(0, max - a.attemptsUsed)
  const playHref = `/gr-classic/play/${game.id}?mode=assignment&a=${assignment.id}`
  const due = a.status === 'overdue' ? <Pill tone="red">{dueLabel(assignment.dueAt)}</Pill> : <Pill tone={a.status === 'submitted' ? 'green' : 'amber'}>{a.status === 'submitted' ? 'Submitted' : dueLabel(assignment.dueAt)}</Pill>

  let action
  if (a.status === 'submitted') action = <Link href={`/gr-classic/student/assignments/${assignment.id}`} className={buttonClass('plain')}>Review</Link>
  else if (a.status === 'in-progress') action = <Link href={playHref} className={buttonClass('teal')}>Continue</Link>
  else if (a.status === 'overdue' && !assignment.settings.allowLate) action = <span className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-500">Closed — ask your teacher</span>
  else action = <Link href={playHref} className={buttonClass(a.status === 'overdue' ? 'amber' : 'primary')}>{a.status === 'overdue' ? 'Start (late)' : 'Start'}</Link>

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <TypeChip type={game.type} />
          {due}
        </div>
        <p className="mt-2 text-xl font-extrabold leading-snug text-slate-900">{game.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-500">
          <span>{a.className}</span>
          <span className="inline-flex items-center gap-1">
            <FiClock aria-hidden /> Due {formatDue(assignment.dueAt)}
          </span>
          <span>{game.questions.length} {game.type === 'match' ? 'boards' : 'questions'}</span>
          <span>{left === null ? 'Unlimited attempts' : `${left} attempt${left === 1 ? '' : 's'} left`}</span>
          {a.bestPercent !== null && <span className="font-extrabold text-teal-700">Best: {a.bestPercent}%</span>}
        </p>
      </div>
      <div className="flex shrink-0 flex-col">{action}</div>
    </Card>
  )
}
