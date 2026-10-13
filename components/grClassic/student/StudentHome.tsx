'use client'

import Link from 'next/link'
import { FiBookOpen, FiEdit3, FiPlayCircle } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { GAMES, SAMPLE_STUDENT, studentAssignments } from '@/lib/grClassic/sampleData'
import { Card, SectionTitle, Shell, TYPE_META, buttonClass } from '../ui'
import { AssignmentCard } from './AssignmentsBoard'

export function StudentHome() {
  const all = studentAssignments()
  const open = all.filter((a) => a.status === 'todo' || a.status === 'in-progress')
  return (
    <Shell back={{ href: '/gr-classic', label: 'Home' }}>
      <h1 className="text-3xl font-black text-slate-900">வணக்கம், {SAMPLE_STUDENT.name}! 👋</h1>
      <p className="font-semibold text-slate-600">What do you want to do?</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <BigTile href="/gr-classic/join" icon={FiPlayCircle} title="Join Live Game" ta="நேரலை விளையாட்டு" cls="from-indigo-600 to-violet-500 shadow-[0_8px_0_0_#3730a3]" />
        <BigTile href="/gr-classic/student/assignments" icon={FiBookOpen} title="My Assignments" ta="என் பணிகள்" cls="from-teal-600 to-emerald-500 shadow-[0_8px_0_0_#115e59]" badge={open.length ? `${open.length} to do` : undefined} />
        <BigTile href="#practice" icon={FiEdit3} title="Practice Games" ta="பயிற்சி" cls="from-rose-600 to-orange-500 shadow-[0_8px_0_0_#9f1239]" />
      </div>

      {open.length > 0 && (
        <>
          <SectionTitle
            action={
              <Link href="/gr-classic/student/assignments" className="text-sm font-bold text-teal-700 hover:underline">
                See all
              </Link>
            }
          >
            Due soon
          </SectionTitle>
          <ul className="grid gap-4 md:grid-cols-2">
            {open.map((a) => (
              <li key={a.assignment.id}>
                <AssignmentCard a={a} />
              </li>
            ))}
          </ul>
        </>
      )}

      <section id="practice" className="scroll-mt-4">
        <SectionTitle>Practice games</SectionTitle>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g) => {
            const m = TYPE_META[g.type]
            const Icon = m.icon
            return (
              <li key={g.id}>
                <Card className="flex h-full items-center gap-4 p-4">
                  <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white ${m.band}`}>
                    <Icon aria-hidden className="h-7 w-7" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold leading-snug text-slate-900">{g.title}</p>
                    <p className="text-xs font-semibold text-slate-500">{m.label}</p>
                  </div>
                  <Link href={`/gr-classic/play/${g.id}?mode=practice`} className={buttonClass('primary', 'sm')} aria-label={`Play ${g.title}`}>
                    Play
                  </Link>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>
    </Shell>
  )
}

function BigTile({ href, icon: Icon, title, ta, cls, badge }: { href: string; icon: IconType; title: string; ta: string; cls: string; badge?: string }) {
  return (
    <Link href={href} className={`relative flex items-center gap-4 rounded-[2rem] bg-gradient-to-br p-6 text-white transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:flex-col sm:items-start ${cls}`}>
      <Icon aria-hidden className="h-10 w-10 shrink-0" />
      <span>
        <span className="block text-2xl font-black">{title}</span>
        <span className="block font-bold opacity-90">{ta}</span>
      </span>
      {badge && <span className="absolute right-4 top-4 rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-teal-800">{badge}</span>}
    </Link>
  )
}
