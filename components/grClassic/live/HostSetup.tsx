'use client'

import Link from 'next/link'
import { FiRadio, FiUsers } from 'react-icons/fi'
import type { GameType, TeacherClass } from '@/lib/grClassic/types'
import { Card, Shell, TypeChip } from '../ui'

// Before a live game: which class is playing? Only that class's students
// can join. (Skipped when the teacher has just one class.)
export function HostSetup({ gameId, title, type, classes }: { gameId: string; title: string; type: GameType; classes: TeacherClass[] }) {
  return (
    <Shell back={{ href: '/gr-classic/teacher', label: 'My Games' }} width="max-w-2xl">
      <Card className="flex items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold text-slate-900">{title}</p>
          <TypeChip type={type} />
        </div>
      </Card>
      <h1 className="mt-6 text-3xl font-black text-slate-900">Which class is playing?</h1>
      <p className="font-semibold text-slate-600">Only students in this class can join with the PIN.</p>
      {classes.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 font-bold text-amber-900 ring-1 ring-amber-200">You don’t have any classes yet. Ask the school admin to add you to a class first.</p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {classes.map((c) => (
            <li key={c.id}>
              {/* prefetch off: opening this link starts the live game */}
              <Link prefetch={false} href={`/gr-classic/host/${gameId}?class=${c.id}`} className="flex items-center gap-4 rounded-3xl bg-white p-5 ring-2 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-indigo-400">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white">
                  <FiRadio aria-hidden className="h-6 w-6" />
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-extrabold text-slate-900">{c.name}</span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-slate-500">
                    <FiUsers aria-hidden /> {c.studentCount} students
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  )
}
