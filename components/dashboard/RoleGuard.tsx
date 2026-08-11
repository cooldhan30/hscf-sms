import { redirect } from 'next/navigation'
import { getCurrentProfile, getAvailableRoles, roleHomePath } from '@/lib/auth'
import type { SmsRole, SmsProfile } from '@/types/database'

// Defense-in-depth: middleware already blocks cross-role access at the
// route level, but each role's layout.tsx renders this too so a mistake
// in the matcher/prefix logic can never expose another role's data.
export async function RoleGuard({
  allow,
  children,
}: {
  allow: SmsRole
  children: (profile: SmsProfile, availableRoles: SmsRole[]) => React.ReactNode
}) {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect('/login')
  }

  if (profile.role !== allow) {
    redirect(roleHomePath(profile.role))
  }

  // Fetched here rather than in each portal's layout so there is exactly
  // one place that decides what a person may switch into.
  const availableRoles = await getAvailableRoles()

  return <>{children(profile, availableRoles)}</>
}
