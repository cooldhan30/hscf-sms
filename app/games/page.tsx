import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FiArrowRight, FiPlayCircle, FiZap } from 'react-icons/fi'
import { DashboardLayout } from '@/components/dashboard'
import { ADMIN_NAV_ITEMS, STUDENT_NAV_ITEMS, TEACHER_NAV_ITEMS } from '@/components/dashboard/roleNav'
import { getAvailableRoles, getCurrentProfile } from '@/lib/auth'
import { isGrClassicEnabled } from '@/lib/grClassic/release'

export const dynamic = 'force-dynamic'

// The sidebar's one "Game Room" item opens this page: choose Classic
// (GameRoom Classic, /gr-classic) or Modern (the Game Room, via its
// rollback-aware entry /gameroom). Nothing here belongs to either game
// room; each keeps its own pages.
const ROLE_CONFIG = {
  student: { label: 'Student', items: STUDENT_NAV_ITEMS, profileHref: '/student/profile', settingsHref: undefined },
  teacher: { label: 'Teacher', items: TEACHER_NAV_ITEMS, profileHref: '/teacher/profile', settingsHref: undefined },
  admin: { label: 'Admin', items: ADMIN_NAV_ITEMS, profileHref: '/admin/profile', settingsHref: '/admin/settings' },
} as const

export default async function GamesPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect(`/login?next=${encodeURIComponent('/games')}`)
  const role = profile.role === 'student' || profile.role === 'teacher' ? profile.role : 'admin'
  const config = ROLE_CONFIG[role]
  const classic = isGrClassicEnabled()

  return (
    <DashboardLayout
      roleLabel={config.label}
      navItems={config.items}
      userName={`${profile.first_name} ${profile.last_name}`.trim() || config.label}
      userRole={profile.role}
      userAvatarUrl={profile.avatar_url}
      availableRoles={await getAvailableRoles()}
      profileHref={config.profileHref}
      settingsHref={config.settingsHref}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Game Room</h1>
          <p className="mt-1 text-stone-500 dark:text-stone-400">Learn Tamil by playing. Which game room?</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {classic && (
            <Choice
              href="/gr-classic"
              title="Classic"
              ta="கிளாசிக்"
              blurb={role === 'student' ? 'Join live class games, do your game assignments, and play any topic on your own.' : 'Quick live games from any topic, game assignments, and the shared question library.'}
              icon={<FiZap aria-hidden className="h-8 w-8" />}
              cls="from-rose-600 to-orange-500"
            />
          )}
          <Choice
            href="/gameroom"
            title="Modern"
            ta="நவீன"
            blurb={role === 'student' ? 'Arcade-style games, adventures and challenges.' : 'Arcade-style games, adventures and challenges for your classes.'}
            icon={<FiPlayCircle aria-hidden className="h-8 w-8" />}
            cls="from-indigo-600 to-violet-500"
          />
        </div>
      </div>
    </DashboardLayout>
  )
}

function Choice({ href, title, ta, blurb, icon, cls }: { href: string; title: string; ta: string; blurb: string; icon: React.ReactNode; cls: string }) {
  return (
    <Link href={href} prefetch={false} className={`group flex flex-col gap-4 rounded-3xl bg-gradient-to-br ${cls} p-6 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:p-8`}>
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20">{icon}</span>
      <span>
        <span className="flex items-center gap-2 text-3xl font-black">
          {title}
          <FiArrowRight aria-hidden className="h-6 w-6 transition group-hover:translate-x-1" />
        </span>
        <span className="block text-lg font-bold opacity-90">{ta}</span>
      </span>
      <span className="font-medium opacity-95">{blurb}</span>
    </Link>
  )
}
