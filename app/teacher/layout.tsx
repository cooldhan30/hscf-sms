import { FiHome, FiBookOpen, FiCheckSquare, FiFileText, FiAward, FiClipboard, FiUser, FiMessageCircle } from 'react-icons/fi'
import { RoleGuard, DashboardLayout, type SidebarItem } from '@/components/dashboard'

const iconClass = 'w-4 h-4 flex-shrink-0'

const navItems: SidebarItem[] = [
  { label: 'Dashboard', href: '/teacher', icon: <FiHome className={iconClass} /> },
  { label: 'My Classes', href: '/teacher/classes', icon: <FiBookOpen className={iconClass} /> },
  { label: 'Attendance', href: '/teacher/attendance', icon: <FiCheckSquare className={iconClass} /> },
  { label: 'Assignments', href: '/teacher/assignments', icon: <FiFileText className={iconClass} /> },
  { label: 'Gradebook', href: '/teacher/gradebook', icon: <FiAward className={iconClass} /> },
  { label: 'Announcements', href: '/teacher/announcements', icon: <FiClipboard className={iconClass} /> },
  { label: 'Chat', href: '/teacher/chat', icon: <FiMessageCircle className={iconClass} /> },
  { label: 'Profile', href: '/teacher/profile', icon: <FiUser className={iconClass} /> },
]

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow="teacher">
      {(profile, availableRoles) => (
        <DashboardLayout
          roleLabel="Teacher"
          navItems={navItems}
          userName={`${profile.first_name} ${profile.last_name}`.trim() || 'Teacher'}
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
