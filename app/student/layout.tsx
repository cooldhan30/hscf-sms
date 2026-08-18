import { FiHome, FiBookOpen, FiFileText, FiAward, FiCheckSquare, FiSpeaker, FiUserCheck, FiMessageCircle, FiVideo, FiFolder, FiBarChart2 } from 'react-icons/fi'
import { RoleGuard, DashboardLayout, type SidebarItem } from '@/components/dashboard'

const iconClass = 'w-4 h-4 flex-shrink-0'

const navItems: SidebarItem[] = [
  { label: 'Dashboard', href: '/student', icon: <FiHome className={iconClass} /> },
  { label: 'Classes', href: '/student/classes', icon: <FiBookOpen className={iconClass} /> },
  { label: 'Assignments', href: '/student/assignments', icon: <FiFileText className={iconClass} /> },
  { label: 'Grades', href: '/student/grades', icon: <FiAward className={iconClass} /> },
  { label: 'Attendance', href: '/student/attendance', icon: <FiCheckSquare className={iconClass} /> },
  { label: 'Reports', href: '/student/reports', icon: <FiBarChart2 className={iconClass} /> },
  { label: 'Resources', href: '/student/resources', icon: <FiFolder className={iconClass} /> },
  { label: 'Announcements', href: '/student/announcements', icon: <FiSpeaker className={iconClass} /> },
  { label: 'Meetings', href: '/student/meetings', icon: <FiVideo className={iconClass} /> },
  { label: 'Chat', href: '/student/chat', icon: <FiMessageCircle className={iconClass} /> },
  { label: 'Link Requests', href: '/student/link-requests', icon: <FiUserCheck className={iconClass} /> },
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow="student">
      {(profile, availableRoles) => (
        <DashboardLayout
          roleLabel="Student"
          navItems={navItems}
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
