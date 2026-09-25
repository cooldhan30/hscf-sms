import { redirect } from 'next/navigation'
import { DashboardLayout, type SidebarItem } from '@/components/dashboard'
import { STUDENT_NAV_ITEMS, TEACHER_NAV_ITEMS, ADMIN_NAV_ITEMS, THENI_NAV_ITEM, GAMEROOM_NAV_HREF } from '@/components/dashboard/roleNav'
import { getCurrentProfile, getAvailableRoles } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { SmsProfile } from '@/types/database'

// Renders a GameRoom application page (home, boards, topics, library,
// builder, analytics, progress, results, live lobby) inside the SAME
// DashboardLayout -- sidebar, top navigation, container and background --
// as every other page of the app. Gameplay screens (/gameroom-v2/play/*,
// /gameroom-v2/live/play/*) deliberately don't use this: they stay
// full-screen and immersive.
//
// The "Game Room" item points at /gameroom-v2 here so it shows as active
// on every GameRoom page; everywhere else it points at /gameroom (the
// rollback-aware entry point, see docs/gameroom-v2-rollback.md).
const ROLE_CONFIG = {
  student: { label: 'Student', items: STUDENT_NAV_ITEMS, profileHref: '/student/profile', settingsHref: undefined },
  teacher: { label: 'Teacher', items: TEACHER_NAV_ITEMS, profileHref: '/teacher/profile', settingsHref: undefined },
  admin: { label: 'Admin', items: ADMIN_NAV_ITEMS, profileHref: '/admin/profile', settingsHref: '/admin/settings' },
} as const

function withGameRoomActive(items: SidebarItem[]): SidebarItem[] {
  const hasGameRoom = items.some((i) => i.href === GAMEROOM_NAV_HREF)
  const mapped = items.map((i) => (i.href === GAMEROOM_NAV_HREF ? { ...i, href: '/gameroom-v2' } : i))
  if (hasGameRoom) return mapped
  // Admins have no Game Room item in their portal nav; add one here so the
  // page they're on is visibly part of the navigation.
  const icon = STUDENT_NAV_ITEMS.find((i) => i.href === GAMEROOM_NAV_HREF)!.icon
  return [...mapped, { label: 'Game Room', href: '/gameroom-v2', icon }]
}

async function navItemsFor(profile: SmsProfile): Promise<SidebarItem[]> {
  if (profile.role === 'student') {
    const supabase = createClient()
    const { data: student } = await supabase.from('sms_students').select('id').eq('profile_id', profile.id).maybeSingle()
    const { data: theni } = student
      ? await supabase.from('sms_theni_enrollments').select('id').eq('student_id', student.id).limit(1).maybeSingle()
      : { data: null }
    return withGameRoomActive(theni ? [...STUDENT_NAV_ITEMS, THENI_NAV_ITEM] : STUDENT_NAV_ITEMS)
  }
  if (profile.role === 'teacher') return withGameRoomActive(TEACHER_NAV_ITEMS)
  return withGameRoomActive(ADMIN_NAV_ITEMS)
}

export async function GameRoomShell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const role = profile.role === 'student' || profile.role === 'teacher' ? profile.role : 'admin'
  const config = ROLE_CONFIG[role]
  const [navItems, availableRoles] = await Promise.all([navItemsFor(profile), getAvailableRoles()])

  return (
    <DashboardLayout
      roleLabel={config.label}
      navItems={navItems}
      userName={`${profile.first_name} ${profile.last_name}`.trim() || config.label}
      userRole={profile.role}
      userAvatarUrl={profile.avatar_url}
      availableRoles={availableRoles}
      profileHref={config.profileHref}
      settingsHref={config.settingsHref}
    >
      {children}
    </DashboardLayout>
  )
}

// The "not available" state every GameRoom page shows when
// requireGameV2Access() refuses (e.g. V2 rolled back and the caller isn't
// on the tester allowlist) -- same EmptyState look as the rest of the app.
export function GameRoomUnavailable({ message }: { message?: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <h1 className="text-xl font-bold text-primary-900 dark:text-white mb-1">Game Room isn&apos;t available</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400">{message ?? 'Game Room is not available for your account right now.'}</p>
    </div>
  )
}
