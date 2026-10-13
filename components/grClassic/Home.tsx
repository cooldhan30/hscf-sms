'use client'

import Link from 'next/link'
import { FiArrowRight, FiBookOpen, FiClipboard, FiEdit3, FiGrid, FiPlayCircle, FiPlusCircle, FiRadio, FiSend, FiBarChart2, FiUser, FiUsers } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { Logo, Shell } from './ui'

type Action = { href: string; label: string; icon: IconType }

const TEACHER: Action[] = [
  { href: '/gr-classic/teacher', label: 'My Games', icon: FiGrid },
  { href: '/gr-classic/teacher/create', label: 'Create Game', icon: FiPlusCircle },
  { href: '/gr-classic/teacher?pick=host', label: 'Host Live Game', icon: FiRadio },
  { href: '/gr-classic/teacher?pick=assign', label: 'Assign Game', icon: FiSend },
  { href: '/gr-classic/teacher?tab=assignments', label: 'My Assignments', icon: FiClipboard },
  { href: '/gr-classic/teacher?tab=assignments', label: 'Results', icon: FiBarChart2 },
]

const STUDENT: Action[] = [
  { href: '/gr-classic/join', label: 'Join Live Game', icon: FiPlayCircle },
  { href: '/gr-classic/student/assignments', label: 'My Assignments', icon: FiBookOpen },
  { href: '/gr-classic/student#practice', label: 'Practice Games', icon: FiEdit3 },
]

export function Home() {
  return (
    <Shell>
      <section className="py-6 text-center sm:py-10">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
          தமிழி <span className="bg-gradient-to-r from-rose-600 to-orange-500 bg-clip-text text-transparent">GameRoom Classic</span>
        </h1>
        <p className="mt-2 text-xl font-bold text-rose-700 sm:text-2xl">விளையாடிக் கற்போம்!</p>
        <p className="mt-1 text-base font-medium text-slate-500">Let&apos;s learn by playing</p>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <RoleCard
          href="/gr-classic/teacher"
          title="I'm a Teacher"
          ta="ஆசிரியர்"
          icon={FiUsers}
          gradient="from-teal-600 to-emerald-500"
          shadow="shadow-[0_8px_0_0_#115e59]"
          actions={TEACHER}
        />
        <RoleCard
          href="/gr-classic/student"
          title="I'm a Student"
          ta="மாணவர்"
          icon={FiUser}
          gradient="from-rose-600 to-orange-500"
          shadow="shadow-[0_8px_0_0_#9f1239]"
          actions={STUDENT}
        />
      </div>
    </Shell>
  )
}

function RoleCard({ href, title, ta, icon: Icon, gradient, shadow, actions }: { href: string; title: string; ta: string; icon: IconType; gradient: string; shadow: string; actions: Action[] }) {
  return (
    <section className={`overflow-hidden rounded-[2rem] bg-gradient-to-br ${gradient} ${shadow} text-white`}>
      <Link href={href} className="group flex items-center gap-4 rounded-[2rem] p-6 sm:p-8">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-white/20">
          <Icon aria-hidden className="h-9 w-9" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-2xl font-black sm:text-3xl">{title}</span>
          <span className="block text-lg font-bold opacity-90">{ta}</span>
        </span>
        <FiArrowRight aria-hidden className="h-8 w-8 shrink-0 transition group-hover:translate-x-1" />
      </Link>
      <ul className={`grid gap-2 px-4 pb-5 sm:px-6 sm:pb-6 ${actions.length > 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {actions.map((a) => (
          <li key={a.label}>
            <Link href={a.href} className="flex h-full items-center gap-2 rounded-2xl bg-white/15 px-3 py-3 text-sm font-bold backdrop-blur-sm transition hover:bg-white/25 sm:text-base">
              <a.icon aria-hidden className="h-5 w-5 shrink-0" />
              {a.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
