import { FiHome, FiUsers, FiUser, FiBookOpen, FiClipboard, FiCheckSquare, FiSpeaker, FiMessageCircle, FiTrendingUp, FiVideo, FiDollarSign, FiFolder, FiFileText, FiBarChart2 } from 'react-icons/fi'
import { RoleGuard, DashboardLayout, type SidebarItem } from '@/components/dashboard'

const iconClass = 'w-4 h-4 flex-shrink-0'

const navItems: SidebarItem[] = [
  { label: 'Dashboard', href: '/admin', icon: <FiHome className={iconClass} /> },
  { label: 'Teachers', href: '/admin/teachers', icon: <FiUser className={iconClass} /> },
  { label: 'Students', href: '/admin/students', icon: <FiUsers className={iconClass} /> },
  { label: 'Classes', href: '/admin/classes', icon: <FiBookOpen className={iconClass} /> },
  { label: 'Assignments', href: '/admin/assignments', icon: <FiFileText className={iconClass} /> },
  { label: 'Promotions', href: '/admin/promotions', icon: <FiTrendingUp className={iconClass} /> },
  { label: 'Attendance', href: '/admin/attendance', icon: <FiCheckSquare className={iconClass} /> },
  { label: 'Registrations', href: '/admin/registrations', icon: <FiClipboard className={iconClass} /> },
  { label: 'Payments', href: '/admin/payments', icon: <FiDollarSign className={iconClass} /> },
  { label: 'Resources', href: '/admin/resources', icon: <FiFolder className={iconClass} /> },
  { label: 'Tamil Theni', href: '/admin/theni', icon: <span className="text-sm">🐝</span> },
  { label: 'Reports', href: '/admin/reports', icon: <FiBarChart2 className={iconClass} /> },
  { label: 'Announcements', href: '/admin/announcements', icon: <FiSpeaker className={iconClass} /> },
  { label: 'Meetings', href: '/admin/meetings', icon: <FiVideo className={iconClass} /> },
  { label: 'Chat', href: '/admin/chat', icon: <FiMessageCircle className={iconClass} /> },
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
          profileHref="/admin/profile"
          settingsHref="/admin/settings"
        >
          {children}
        </DashboardLayout>
      )}
    </RoleGuard>
  )
}
