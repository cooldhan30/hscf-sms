import { RoleGuard, DashboardLayout } from '@/components/dashboard'
import { STUDENT_NAV_ITEMS } from '@/components/dashboard/roleNav'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow="student">
      {(profile, availableRoles) => (
        <DashboardLayout
          roleLabel="Student"
          navItems={STUDENT_NAV_ITEMS}
          userName={`${profile.first_name} ${profile.last_name}`.trim() || 'Student'}
          userRole={profile.role}
          userAvatarUrl={profile.avatar_url}
          availableRoles={availableRoles}
          profileHref="/student/profile"
        >
          {children}
        </DashboardLayout>
      )}
    </RoleGuard>
  )
}
