import { FiHome, FiBookOpen, FiCheckSquare, FiFileText, FiAward, FiClipboard, FiMessageCircle, FiVideo, FiFolder, FiBarChart2, FiFeather, FiPlayCircle } from 'react-icons/fi'
import { RoleGuard, DashboardLayout, type SidebarItem } from '@/components/dashboard'

const iconClass = 'w-4 h-4 flex-shrink-0'

const navItems: SidebarItem[] = [
  { label: 'Dashboard', href: '/teacher', icon: <FiHome className={iconClass} /> },
  { label: 'My Classes', href: '/teacher/classes', icon: <FiBookOpen className={iconClass} /> },
  { label: 'Attendance', href: '/teacher/attendance', icon: <FiCheckSquare className={iconClass} /> },
  { label: 'Assignments', href: '/teacher/assignments', icon: <FiFileText className={iconClass} /> },
  { label: 'Gradebook', href: '/teacher/gradebook', icon: <FiAward className={iconClass} /> },
  { label: 'Reports', href: '/teacher/reports', icon: <FiBarChart2 className={iconClass} /> },
  { label: 'Resources', href: '/teacher/resources', icon: <FiFolder className={iconClass} /> },
  { label: 'Story Generator', href: '/teacher/story-generator', icon: <FiFeather className={iconClass} /> },
  // GameRoom mode selector (new vs Classic); Classic stays at /teacher/game-room.
  { label: 'Game Room', href: '/gameroom', icon: <FiPlayCircle className={iconClass} /> },
  { label: 'Announcements', href: '/teacher/announcements', icon: <FiClipboard className={iconClass} /> },
  { label: 'Meetings', href: '/teacher/meetings', icon: <FiVideo className={iconClass} /> },
  { label: 'Chat', href: '/teacher/chat', icon: <FiMessageCircle className={iconClass} /> },
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
          profileHref="/teacher/profile"
        >
          {children}
        </DashboardLayout>
      )}
    </RoleGuard>
  )
}
