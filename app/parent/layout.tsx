import { FiHome, FiUsers, FiCheckSquare, FiAward, FiFileText, FiSpeaker, FiUser, FiMessageCircle } from 'react-icons/fi'
import { RoleGuard, DashboardLayout, type SidebarItem } from '@/components/dashboard'

const iconClass = 'w-4 h-4 flex-shrink-0'

const navItems: SidebarItem[] = [
  { label: 'Dashboard', href: '/parent', icon: <FiHome className={iconClass} /> },
  { label: 'Children', href: '/parent/children', icon: <FiUsers className={iconClass} /> },
  { label: 'Attendance', href: '/parent/attendance', icon: <FiCheckSquare className={iconClass} /> },
  { label: 'Grades', href: '/parent/grades', icon: <FiAward className={iconClass} /> },
  { label: 'Assignments', href: '/parent/assignments', icon: <FiFileText className={iconClass} /> },
  { label: 'Announcements', href: '/parent/announcements', icon: <FiSpeaker className={iconClass} /> },
  { label: 'Chat', href: '/parent/chat', icon: <FiMessageCircle className={iconClass} /> },
  { label: 'Profile', href: '/parent/profile', icon: <FiUser className={iconClass} /> },
]

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow="parent">
      {(profile, availableRoles) => (
        <DashboardLayout
          roleLabel="Parent"
          navItems={navItems}
          userName={`${profile.first_name} ${profile.last_name}`.trim() || 'Parent'}
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
