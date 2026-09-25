import { RoleGuard, DashboardLayout } from '@/components/dashboard'
import { TEACHER_NAV_ITEMS } from '@/components/dashboard/roleNav'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow="teacher">
      {(profile, availableRoles) => (
        <DashboardLayout
          roleLabel="Teacher"
          navItems={TEACHER_NAV_ITEMS}
          userName={`${profile.first_name} ${profile.last_name}`.trim() || 'Teacher'}
          userRole={profile.role}
          userAvatarUrl={profile.avatar_url}
          availableRoles={availableRoles}
          profileHref="/teacher/profile"
        >
          {children}
        </DashboardLayout>
      )}
    </RoleGuard>
  )
}
