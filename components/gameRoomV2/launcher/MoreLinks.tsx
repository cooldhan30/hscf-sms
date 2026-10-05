import Link from 'next/link'
import { FiBarChart2, FiEdit3, FiGrid, FiBookOpen, FiFolder, FiTrendingUp } from 'react-icons/fi'
import type { IconType } from 'react-icons'

// Everything that used to crowd the GameRoom home, one quiet row at the
// bottom: nothing is removed, it just isn't in the way of playing.
const LINKS: Record<'student' | 'teacher', { href: string; label: string; icon: IconType }[]> = {
  student: [
    { href: '/gameroom-v2/progress', label: 'My progress & badges', icon: FiTrendingUp },
    { href: '/gameroom-v2/trace', label: 'Trace & Learn', icon: FiEdit3 },
    { href: '/gameroom-v2/boards', label: 'Learning Boards', icon: FiGrid },
    { href: '/gameroom-v2/topics', label: 'All topics', icon: FiBookOpen },
  ],
  teacher: [
    { href: '/gameroom-v2/library', label: 'Question library & sharing', icon: FiFolder },
    { href: '/gameroom-v2/analytics', label: 'Analytics', icon: FiBarChart2 },
    { href: '/gameroom-v2/boards', label: 'Learning Boards', icon: FiGrid },
    { href: '/gameroom-v2/trace', label: 'Trace & Learn', icon: FiEdit3 },
  ],
}

export function MoreLinks({ role }: { role: 'student' | 'teacher' }) {
  return (
    <nav aria-label="More in the Game Room" className="border-t border-stone-200 dark:border-stone-800 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-2">More</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {LINKS[role].map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="min-h-[40px] inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline">
              <Icon className="w-4 h-4" aria-hidden /> {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
