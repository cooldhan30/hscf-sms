'use client'

import { Fragment, useMemo, useState } from 'react'
import { FiCalendar, FiDownload, FiLock, FiPlus, FiUnlock } from 'react-icons/fi'
import { downloadText, dueLabel, formatDate, formatDue, isPast, toCsv } from '@/lib/grClassic/format'
import type { Assignment, StudentResult } from '@/lib/grClassic/types'
import { Button, Card, Pill, Shell, TypeChip } from '../ui'
import { grcApi } from './api'
import { settingsSummary } from './AssignForm'

type Row = StudentResult & { overdue: boolean }

export interface ResultsView {
  assignment: Assignment
  classes: { id: string; name: string }[]
  results: StudentResult[]
}

// One assignment's results: who has finished, who hasn't, scores, and the
// questions the class found hardest. Only the teacher who made the
// assignment sees this (enforced by the database, migration 095).
export function AssignmentResults({ view }: { view: ResultsView }) {
  const { assignment, classes } = view
  const [status, setStatus] = useState(assignment.status)
  const [dueAt, setDueAt] = useState(assignment.dueAt)
  const [extending, setExtending] = useState(false)
  const [newDue, setNewDue] = useState('')
  const [results, setResults] = useState(view.results)
  const [classFilter, setClassFilter] = useState('all')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? 'Class'
  const max = assignment.settings.maxAttempts

  const rows: Row[] = results.filter((r) => classFilter === 'all' || r.classId === classFilter).map((r) => ({ ...r, overdue: r.status !== 'submitted' && isPast(dueAt) }))
  const submitted = rows.filter((r) => r.status === 'submitted')
  const avg = submitted.length ? Math.round(submitted.reduce((n, r) => n + (r.percent ?? 0), 0) / submitted.length) : null
  const passing = assignment.settings.passingPercent

  const missed = useMemo(() => {
    const byQ = new Map<string, { prompt: string; missed: number; seen: number }>()
    for (const r of submitted)
      for (const q of r.questions) {
        const e = byQ.get(q.questionId) ?? { prompt: q.prompt, missed: 0, seen: 0 }
        e.seen++
        if (q.correctUnits < q.totalUnits) e.missed++
        byQ.set(q.questionId, e)
      }
    return Array.from(byQ.values())
      .filter((e) => e.missed > 0)
      .sort((a, b) => b.missed / b.seen - a.missed / a.seen)
      .slice(0, 3)
  }, [submitted])

  const update = async (body: { dueAt?: string; status?: 'open' | 'closed' }) => {
    setBusy(true)
    const res = await grcApi<{ dueAt: string; status: 'open' | 'closed' }>(`/assignments/${assignment.id}`, { method: 'PATCH', body })
    setBusy(false)
    if (!res.ok) return setNotice(res.error)
    setDueAt(res.data.dueAt)
    setStatus(res.data.status)
    setNotice(body.dueAt ? `New due date: ${formatDue(res.data.dueAt)}.` : res.data.status === 'closed' ? 'Assignment closed. Students can no longer start it.' : 'Assignment reopened.')
  }

  const grant = async (r: Row) => {
    const res = await grcApi<{ extra: number }>(`/assignments/${assignment.id}/grant`, { method: 'POST', body: { studentId: r.studentId } })
    if (!res.ok) return setNotice(res.error)
    setResults((rs) => rs.map((x) => (x.studentId === r.studentId ? { ...x, extraAttempts: res.data.extra, attemptLimit: max === null ? null : max + res.data.extra } : x)))
    setNotice(`${r.name} can now have one more attempt.`)
  }

  const exportCsv = () => {
    const csv = toCsv([
      ['Student', 'Class', 'Status', 'Score %', 'Attempts', 'Submitted at', 'Late'],
      ...rows.map((r) => [r.name, className(r.classId), statusText(r), r.percent, r.attemptsUsed, r.submittedAt ? formatDate(r.submittedAt) : '', r.late ? 'yes' : '']),
    ])
    downloadText(`${assignment.title} results.csv`, csv)
  }

  return (
    <Shell back={{ href: '/gr-classic/teacher?tab=assignments', label: 'Assignments' }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TypeChip type={assignment.type} />
            {status === 'closed' ? <Pill>Closed</Pill> : isPast(dueAt) ? <Pill tone="red">Past due</Pill> : <Pill tone="green">Open</Pill>}
          </div>
          <h1 className="mt-2 text-3xl font-black text-slate-900">{assignment.title}</h1>
          <p className="font-semibold text-slate-600">
            {classes.map((c) => c.name).join(', ')} · Due {formatDue(dueAt)} ({dueLabel(dueAt)})
          </p>
          <p className="text-sm text-slate-500">{settingsSummary(assignment.settings)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button tone="plain" size="sm" onClick={() => setExtending((v) => !v)} aria-expanded={extending}>
            <FiCalendar aria-hidden /> Extend deadline
          </Button>
          <Button tone="plain" size="sm" disabled={busy} onClick={() => update({ status: status === 'open' ? 'closed' : 'open' })}>
            {status === 'open' ? (
              <>
                <FiLock aria-hidden /> Close
              </>
            ) : (
              <>
                <FiUnlock aria-hidden /> Reopen
              </>
            )}
          </Button>
          <Button tone="teal" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <FiDownload aria-hidden /> Export CSV
          </Button>
        </div>
      </div>

      {notice && (
        <p role="status" className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white">
          {notice}
          <button type="button" className="text-sm font-bold text-white/80 hover:text-white" onClick={() => setNotice('')}>
            Dismiss
          </button>
        </p>
      )}

      {extending && (
        <Card className="mt-4 flex flex-wrap items-end gap-3 p-4">
          <label className="text-sm font-bold text-slate-700">
            New due date
            <input type="datetime-local" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="mt-1 block rounded-xl border-0 px-3 py-2 ring-2 ring-slate-200 focus:outline-none focus:ring-teal-500" />
          </label>
          <Button
            tone="teal"
            size="sm"
            disabled={!newDue || busy}
            onClick={async () => {
              await update({ dueAt: new Date(newDue).toISOString(), ...(status === 'closed' ? { status: 'open' as const } : {}) })
              setExtending(false)
            }}
          >
            Save
          </Button>
        </Card>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Assigned" value={rows.length} />
        <Stat label="Submitted" value={submitted.length} tone="text-emerald-600" />
        <Stat label="In progress" value={rows.filter((r) => r.status === 'in-progress').length} tone="text-sky-600" />
        <Stat label="Not started" value={rows.filter((r) => r.status === 'not-started').length} tone="text-slate-500" />
        <Stat label="Overdue" value={rows.filter((r) => r.overdue).length} tone="text-rose-600" />
        <Stat label="Average" value={avg === null ? '—' : `${avg}%`} tone="text-indigo-600" />
      </dl>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_18rem]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <h2 className="text-lg font-extrabold text-slate-900">Students</h2>
            {classes.length > 1 && (
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Filter by class" className="rounded-xl border-0 px-3 py-1.5 text-sm font-bold ring-2 ring-slate-200">
                <option value="all">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="p-8 text-center font-semibold text-slate-500">No students are enrolled in {classes.length > 1 ? 'these classes' : 'this class'} yet.</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Student</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Score</th>
                    <th className="px-3 py-3">Attempts</th>
                    <th className="px-3 py-3">Submitted at</th>
                    <th className="px-3 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <Fragment key={r.studentId}>
                      <tr className="align-middle">
                        <td className="px-5 py-3">
                          <span className="font-extrabold text-slate-900">{r.name}</span>
                          <span className="block text-xs font-semibold text-slate-500">{className(r.classId)}</span>
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill row={r} />
                        </td>
                        <td className="px-3 py-3 text-base font-extrabold text-slate-900">
                          {r.percent === null ? '—' : `${r.percent}%`}
                          {r.percent !== null && passing !== null && (r.percent >= passing ? <span className="ml-1 text-xs font-bold text-emerald-700">pass</span> : <span className="ml-1 text-xs font-bold text-rose-700">below {passing}%</span>)}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-700">
                          {r.attemptsUsed}
                          {r.attemptLimit !== null && ` / ${r.attemptLimit}`}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-600">
                          {r.submittedAt ? formatDate(r.submittedAt) : '—'}
                          {r.late && <span className="ml-1 text-xs font-bold text-amber-700">late</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {r.status === 'submitted' && (
                            <Button tone="ghost" size="sm" aria-expanded={open === r.studentId} onClick={() => setOpen(open === r.studentId ? null : r.studentId)}>
                              {open === r.studentId ? 'Hide' : 'View'}
                            </Button>
                          )}
                          {max !== null && (
                            <Button tone="ghost" size="sm" onClick={() => grant(r)} title={`Give ${r.name} one more attempt`}>
                              <FiPlus aria-hidden /> Attempt
                            </Button>
                          )}
                        </td>
                      </tr>
                      {open === r.studentId && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-5 py-3">
                            <ol className="space-y-1.5">
                              {r.questions.map((q, i) => {
                                const ok = q.correctUnits === q.totalUnits
                                return (
                                  <li key={q.questionId} className="flex gap-2">
                                    <span aria-label={ok ? 'Right' : 'Missed'} className={`font-black ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {ok ? '✓' : '✗'}
                                    </span>
                                    <span>
                                      <span className="font-bold text-slate-800">
                                        {i + 1}. {q.prompt}
                                      </span>
                                      {q.totalUnits > 1 && (
                                        <span className="ml-1 text-xs font-semibold text-slate-500">
                                          ({q.correctUnits}/{q.totalUnits} pairs)
                                        </span>
                                      )}
                                      {!ok && (
                                        <span className="block text-xs text-slate-600">
                                          Answered: {q.given} · Right: {q.expected}
                                        </span>
                                      )}
                                    </span>
                                  </li>
                                )
                              })}
                            </ol>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit p-5">
          <h2 className="text-lg font-extrabold text-slate-900">Most missed</h2>
          {missed.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-slate-500">No misses yet.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {missed.map((m) => (
                <li key={m.prompt}>
                  <p className="font-bold text-slate-800">{m.prompt}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-rose-500" style={{ width: `${(100 * m.missed) / m.seen}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {m.missed}/{m.seen} missed
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </Shell>
  )
}

function statusText(r: Row): string {
  if (r.status === 'submitted') return 'Submitted'
  if (r.overdue) return 'Overdue'
  return r.status === 'in-progress' ? 'In progress' : 'Not started'
}

function StatusPill({ row }: { row: Row }) {
  const tone = row.status === 'submitted' ? 'green' : row.overdue ? 'red' : row.status === 'in-progress' ? 'blue' : 'slate'
  return <Pill tone={tone}>{statusText(row)}</Pill>
}

function Stat({ label, value, tone = 'text-slate-900' }: { label: string; value: number | string; tone?: string }) {
  return (
    <Card className="p-4">
      <dt className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-3xl font-black ${tone}`}>{value}</dd>
    </Card>
  )
}
