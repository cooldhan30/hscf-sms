'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FiCalendar, FiZap } from 'react-icons/fi'
import { dueLabel, formatDate, formatDue, isPast } from '@/lib/grClassic/format'
import type { AssignmentSummary, StudentAssignment } from '@/lib/grClassic/types'

// GameRoom Classic sections inside the portal's own pages (student
// Assignments and Grades, teacher Assignments and Gradebook). Styled like
// the portal, not like GameRoom Classic. Dates are shown once in the
// browser so they use the viewer's own time zone.

function useMounted() {
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  return m
}

const card = 'p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900'
const button = 'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white bg-primary-700 hover:bg-primary-800'
const ghost = 'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-primary-800 dark:text-primary-300 border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'

function Heading({ children, sub }: { children: React.ReactNode; sub: string }) {
  return (
    <div className="flex items-start gap-2">
      <FiZap aria-hidden className="mt-1 h-4 w-4 flex-shrink-0 text-terracotta-600 dark:text-terracotta-400" />
      <div>
        <h2 className="text-lg font-bold text-primary-900 dark:text-white">{children}</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">{sub}</p>
      </div>
    </div>
  )
}

// Student Assignments page.
export function StudentGamesSection({ items }: { items: StudentAssignment[] }) {
  const mounted = useMounted()
  if (!items.length || !mounted) return null
  return (
    <section className="space-y-3" aria-label="GameRoom Classic games">
      <Heading sub="Assigned games — your score is worked out automatically.">GameRoom Classic games</Heading>
      {items.map((a) => {
        const s = a.assignment
        const open = s.status === 'open' && (!isPast(s.dueAt) || s.settings.allowLate)
        const left = a.attemptLimit === null ? null : Math.max(0, a.attemptLimit - a.attemptsUsed)
        const action =
          a.status === 'submitted'
            ? { href: `/gr-classic/student/assignments/${s.id}`, label: 'Review', primary: false }
            : open
              ? { href: `/gr-classic/assignment/${s.id}`, label: a.status === 'in-progress' ? 'Continue' : 'Start', primary: true }
              : null
        return (
          <div key={s.id} className={card}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-600 dark:text-terracotta-400">{a.className}</p>
                <h3 className="mt-0.5 font-bold text-stone-800 dark:text-stone-100">{s.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-stone-500 dark:text-stone-400">
                  <span className="flex items-center gap-1.5">
                    <FiCalendar className="h-3.5 w-3.5" aria-hidden /> Due {formatDue(s.dueAt)}
                  </span>
                  <span>{a.status === 'submitted' ? `Score ${a.bestPercent ?? 0}%` : a.status === 'overdue' ? (s.status === 'closed' ? 'Closed' : dueLabel(s.dueAt)) : a.status === 'in-progress' ? 'In progress' : 'To do'}</span>
                  {left !== null && a.status !== 'submitted' && <span>{left} attempt{left === 1 ? '' : 's'} left</span>}
                </div>
              </div>
              {action ? (
                <Link href={action.href} className={action.primary ? button : ghost}>
                  {action.label}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-stone-500 dark:text-stone-400">Closed</span>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}

// Student Grades page: submitted GameRoom Classic assignments.
export function StudentGameScores({ items }: { items: StudentAssignment[] }) {
  const mounted = useMounted()
  const done = items.filter((a) => a.status === 'submitted' && a.bestPercent !== null)
  if (!done.length || !mounted) return null
  return (
    <section className="space-y-3" aria-label="GameRoom Classic scores">
      <Heading sub="Worked out automatically when you submitted.">GameRoom Classic scores</Heading>
      <div className="overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-stone-500 dark:bg-stone-900 dark:text-stone-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Game</th>
              <th className="px-4 py-2 font-semibold">Class</th>
              <th className="px-4 py-2 font-semibold">Score</th>
              <th className="hidden px-4 py-2 font-semibold sm:table-cell">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 bg-white dark:divide-stone-800 dark:bg-stone-900">
            {done.map((a) => (
              <tr key={a.assignment.id}>
                <td className="px-4 py-2">
                  <Link href={`/gr-classic/student/assignments/${a.assignment.id}`} className="font-semibold text-primary-800 hover:underline dark:text-primary-300">
                    {a.assignment.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-stone-600 dark:text-stone-300">{a.className}</td>
                <td className="px-4 py-2 font-bold text-stone-800 dark:text-stone-100">{a.bestPercent}%</td>
                <td className="hidden px-4 py-2 text-stone-500 dark:text-stone-400 sm:table-cell">{a.submittedAt ? formatDate(a.submittedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// Teacher Assignments and Gradebook pages.
export function TeacherGamesSection({ items }: { items: AssignmentSummary[] }) {
  const mounted = useMounted()
  if (!mounted) return null
  return (
    <section className="space-y-3" aria-label="GameRoom Classic assignments">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Heading sub="Graded automatically. Open one to see scores, answers and CSV export.">GameRoom Classic assignments</Heading>
        <Link href="/gr-classic/teacher" className={ghost}>
          Assign a game
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">None yet — press Assign on any game in GameRoom Classic.</p>
      ) : (
        items.slice(0, 8).map((a) => (
          <div key={a.id} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-stone-800 dark:text-stone-100">{a.title}</h3>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {a.classNames.join(', ')} · Due {formatDue(a.dueAt)}
                  {a.status === 'closed' ? ' · Closed' : ''}
                  {!a.mine ? ` · from ${a.ownerName}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                  {a.submitted}/{a.students} submitted
                </span>
                <Link href={`/gr-classic/teacher/assignments/${a.id}`} className={button}>
                  View results
                </Link>
              </div>
            </div>
          </div>
        ))
      )}
      {items.length > 8 && (
        <Link href="/gr-classic/teacher?tab=assignments" className="text-sm font-semibold text-primary-800 hover:underline dark:text-primary-300">
          See all {items.length} GameRoom Classic assignments
        </Link>
      )}
    </section>
  )
}
