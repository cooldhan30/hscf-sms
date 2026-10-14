'use client'

import { formatDate } from '@/lib/grClassic/format'
import type { PracticeStats } from '@/lib/grClassic/types'
import { Card, Pill, Shell, TypeChip } from '../ui'

// Who has practised a game, how often, and how they did. Practice scores
// are encouragement only -- they are never grades.
export function PracticeStatsView({ stats }: { stats: PracticeStats }) {
  const { rows } = stats
  const plays = rows.reduce((n, r) => n + r.plays, 0)
  const avgBest = rows.length ? Math.round(rows.reduce((n, r) => n + r.bestPercent, 0) / rows.length) : null
  return (
    <Shell back={{ href: '/gr-classic/teacher', label: 'My Games' }} width="max-w-4xl">
      <div className="flex flex-wrap items-center gap-2">
        <TypeChip type={stats.type} />
        {stats.practice ? <Pill tone="green">Practice: On</Pill> : <Pill>Practice: Off</Pill>}
      </div>
      <h1 className="mt-2 text-3xl font-black text-slate-900">{stats.title}</h1>
      <p className="font-semibold text-slate-600">Practice — scores here are just for encouragement, not grades.</p>

      <dl className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Students" value={rows.length} />
        <Stat label="Times played" value={plays} />
        <Stat label="Average best" value={avgBest === null ? '—' : `${avgBest}%`} />
      </dl>

      <Card className="mt-6 overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-8 text-center font-semibold text-slate-500">No student has practised this game yet.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-3 py-3">Times played</th>
                  <th className="px-3 py-3">Best</th>
                  <th className="px-3 py-3">Latest</th>
                  <th className="px-3 py-3">Last played</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.studentId}>
                    <td className="px-5 py-3 font-extrabold text-slate-900">{r.name}</td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{r.plays}</td>
                    <td className="px-3 py-3 text-base font-extrabold text-slate-900">{r.bestPercent}%</td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{r.lastPercent}%</td>
                    <td className="px-3 py-3 font-semibold text-slate-600">{formatDate(r.lastPlayedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Shell>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <dt className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-3xl font-black text-slate-900">{value}</dd>
    </Card>
  )
}
