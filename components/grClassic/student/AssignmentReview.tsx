'use client'

import { formatDate, formatDue, isPast } from '@/lib/grClassic/format'
import { encouragement } from '@/lib/grClassic/scoring'
import type { StudentAssignment } from '@/lib/grClassic/types'
import { ReviewList } from '../games/GamePlayer'
import { ButtonLink, Card, Shell, TypeChip } from '../ui'

// A student's own submitted assignment. Correct answers are only shown
// when the teacher's setting allows it (default: after the due date).
export function AssignmentReview({ a }: { a: StudentAssignment }) {
  const { assignment, game } = a
  const s = assignment.settings
  const showAnswers = s.showAnswers === 'after-submit' || (s.showAnswers === 'after-due' && isPast(assignment.dueAt))
  const max = s.maxAttempts
  const left = max === null ? null : Math.max(0, max - a.attemptsUsed)
  const canRetry = (left === null || left > 0) && assignment.status === 'open' && (!isPast(assignment.dueAt) || s.allowLate)
  const msg = encouragement(a.bestPercent ?? 0)
  return (
    <Shell back={{ href: '/gr-classic/student/assignments', label: 'My Assignments' }} width="max-w-3xl">
      <Card className="p-6 sm:p-8">
        <TypeChip type={game.type} />
        <h1 className="mt-2 text-3xl font-black text-slate-900">{game.title}</h1>
        <p className="font-semibold text-slate-600">
          {a.className} · Due {formatDue(assignment.dueAt)}
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-teal-50 p-4">
            <p className="text-xs font-extrabold uppercase text-teal-800">{s.scorePolicy === 'best' ? 'Best score' : 'Latest score'}</p>
            <p className="text-4xl font-black text-teal-700">{a.bestPercent}%</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-extrabold uppercase text-slate-500">Attempts left</p>
            <p className="text-4xl font-black text-slate-800">{left === null ? '∞' : left}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-extrabold uppercase text-slate-500">Submitted</p>
            <p className="mt-2 font-extrabold text-slate-800">{a.submittedAt ? formatDate(a.submittedAt) : '—'}</p>
          </div>
        </div>
        <p className="mt-4 text-center text-lg font-extrabold text-slate-800">
          {msg.ta} <span className="font-semibold text-slate-500">{msg.en}</span>
        </p>
        {canRetry && (
          <div className="mt-4 text-center">
            <ButtonLink href={`/gr-classic/play/${game.id}?mode=assignment&a=${assignment.id}`} tone="teal">
              Try again
            </ButtonLink>
          </div>
        )}
      </Card>
      {!showAnswers && <p className="mt-4 rounded-2xl bg-sky-50 px-4 py-3 text-center font-bold text-sky-900 ring-1 ring-sky-200">{s.showAnswers === 'never' ? 'Your teacher has chosen not to show the right answers.' : `Right answers will appear after ${formatDue(assignment.dueAt)}.`}</p>}
      <ReviewList results={a.questions} showAnswers={showAnswers} />
    </Shell>
  )
}
