'use client'

import Link from 'next/link'
import { FiBookOpen, FiGrid, FiPlayCircle } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import type { TopicScore } from '@/lib/grClassic/topicPlay'
import type { StudentAssignment } from '@/lib/grClassic/types'
import { SectionTitle, Shell } from '../ui'
import { AssignmentCard } from './AssignmentsBoard'
import { TopicScores } from './TopicScores'

// The student home. Play Offline: any topics of the question library, on
// your own (not a teacher's live game), with your own number of questions
// and time; the dashboard below shows the scores per topic.
export function StudentHome({ name, assignments, scores }: { name: string; assignments: StudentAssignment[]; scores: TopicScore[] }) {
  const open = assignments.filter((a) => a.status === 'todo' || a.status === 'in-progress')
  return (
    <Shell>
      <h1 className="text-3xl font-black text-slate-900">வணக்கம், {name}! 👋</h1>
      <p className="font-semibold text-slate-600">What do you want to do?</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <BigTile href="/gr-classic/join" icon={FiPlayCircle} title="Join Live Game" ta="நேரலை விளையாட்டு" cls="from-indigo-600 to-violet-500 shadow-[0_8px_0_0_#3730a3]" />
        <BigTile href="/gr-classic/student/assignments" icon={FiBookOpen} title="My Assignments" ta="என் பணிகள்" cls="from-teal-600 to-emerald-500 shadow-[0_8px_0_0_#115e59]" badge={open.length ? `${open.length} to do` : undefined} />
        <BigTile href="/gr-classic/student/topics" icon={FiGrid} title="Play Offline" ta="தனியாக விளையாடு" cls="from-rose-600 to-orange-500 shadow-[0_8px_0_0_#9f1239]" />
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

      <TopicScores scores={scores} />
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
