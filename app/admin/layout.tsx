import { RoleGuard, DashboardLayout } from '@/components/dashboard'
import { ADMIN_NAV_ITEMS } from '@/components/dashboard/roleNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow="admin">
      {(profile, availableRoles) => (
        <DashboardLayout
          roleLabel="Admin"
          navItems={ADMIN_NAV_ITEMS}
          userName={`${profile.first_name} ${profile.last_name}`.trim() || 'Admin'}
          userRole={profile.role}
          userAvatarUrl={profile.avatar_url}
          availableRoles={availableRoles}
          profileHref="/admin/profile"
          settingsHref="/admin/settings"
        >
          {children}
        </DashboardLayout>
      )}
    </RoleGuard>
  )
}
