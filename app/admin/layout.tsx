import { FiHome, FiUsers, FiUser, FiBookOpen, FiClipboard, FiCheckSquare, FiSpeaker, FiMessageCircle, FiSettings, FiUserCheck, FiTrendingUp } from 'react-icons/fi'
import { RoleGuard, DashboardLayout, type SidebarItem } from '@/components/dashboard'

const iconClass = 'w-4 h-4 flex-shrink-0'

const navItems: SidebarItem[] = [
  { label: 'Dashboard', href: '/admin', icon: <FiHome className={iconClass} /> },
  { label: 'Teachers', href: '/admin/teachers', icon: <FiUser className={iconClass} /> },
  { label: 'Students', href: '/admin/students', icon: <FiUsers className={iconClass} /> },
  { label: 'Classes', href: '/admin/classes', icon: <FiBookOpen className={iconClass} /> },
  { label: 'Promotions', href: '/admin/promotions', icon: <FiTrendingUp className={iconClass} /> },
  { label: 'Attendance', href: '/admin/attendance', icon: <FiCheckSquare className={iconClass} /> },
  { label: 'Registrations', href: '/admin/registrations', icon: <FiClipboard className={iconClass} /> },
  { label: 'Announcements', href: '/admin/announcements', icon: <FiSpeaker className={iconClass} /> },
  { label: 'Chat', href: '/admin/chat', icon: <FiMessageCircle className={iconClass} /> },
  { label: 'Profile', href: '/admin/profile', icon: <FiUserCheck className={iconClass} /> },
  { label: 'Settings', href: '/admin/settings', icon: <FiSettings className={iconClass} /> },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow="admin">
      {(profile, availableRoles) => (
        <DashboardLayout
          roleLabel="Admin"
          navItems={navItems}
          userName={`${profile.first_name} ${profile.last_name}`.trim() || 'Admin'}
          userRole={profile.role}
          userAvatarUrl={profile.avatar_url}
          availableRoles={availableRoles}
        >
          {children}
        </DashboardLayout>
      )}
    </RoleGuard>
  )
}
