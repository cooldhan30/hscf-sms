import {
  FiHome,
  FiBookOpen,
  FiFileText,
  FiAward,
  FiCheckSquare,
  FiSpeaker,
  FiUserCheck,
  FiMessageCircle,
  FiVideo,
  FiFolder,
  FiBarChart2,
  FiPlayCircle,
  FiUsers,
  FiUser,
  FiClipboard,
  FiFeather,
  FiTrendingUp,
  FiDollarSign,
} from 'react-icons/fi'
import type { SidebarItem } from './Sidebar'

// Sidebar items per role, shared by each portal's layout.tsx and by the
// GameRoom shell (app/gameroom-v2/(app)/layout.tsx), so GameRoom pages
// render inside exactly the same navigation as the rest of the app.
const iconClass = 'w-4 h-4 flex-shrink-0'

// /gameroom is the stable entry point: it opens GameRoom V2, or Classic
// GameRoom if V2 is rolled back (GAMEROOM_V2_ENABLED=false). See
// docs/gameroom-v2-rollback.md.
export const GAMEROOM_NAV_HREF = '/gameroom'

export const STUDENT_NAV_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', href: '/student', icon: <FiHome className={iconClass} /> },
  { label: 'Classes', href: '/student/classes', icon: <FiBookOpen className={iconClass} /> },
  { label: 'Assignments', href: '/student/assignments', icon: <FiFileText className={iconClass} /> },
  { label: 'Class Progress', href: '/student/class-progress', icon: <FiUsers className={iconClass} /> },
  { label: 'Grades', href: '/student/grades', icon: <FiAward className={iconClass} /> },
  { label: 'Attendance', href: '/student/attendance', icon: <FiCheckSquare className={iconClass} /> },
  { label: 'Reports', href: '/student/reports', icon: <FiBarChart2 className={iconClass} /> },
  { label: 'Resources', href: '/student/resources', icon: <FiFolder className={iconClass} /> },
  { label: 'Announcements', href: '/student/announcements', icon: <FiSpeaker className={iconClass} /> },
  { label: 'Meetings', href: '/student/meetings', icon: <FiVideo className={iconClass} /> },
  { label: 'Chat', href: '/student/chat', icon: <FiMessageCircle className={iconClass} /> },
  { label: 'Link Requests', href: '/student/link-requests', icon: <FiUserCheck className={iconClass} /> },
  { label: 'Game Room', href: GAMEROOM_NAV_HREF, icon: <FiPlayCircle className={iconClass} /> },
]

// Shown only once the student has joined a Tamil Theni season.
export const THENI_NAV_ITEM: SidebarItem = { label: 'Tamil Theni', href: '/student/theni', icon: <span className="text-sm">🐝</span> }

export const TEACHER_NAV_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', href: '/teacher', icon: <FiHome className={iconClass} /> },
  { label: 'My Classes', href: '/teacher/classes', icon: <FiBookOpen className={iconClass} /> },
  { label: 'Attendance', href: '/teacher/attendance', icon: <FiCheckSquare className={iconClass} /> },
  { label: 'Assignments', href: '/teacher/assignments', icon: <FiFileText className={iconClass} /> },
  { label: 'Class Progress', href: '/teacher/class-progress', icon: <FiUsers className={iconClass} /> },
  { label: 'Gradebook', href: '/teacher/gradebook', icon: <FiAward className={iconClass} /> },
  { label: 'Reports', href: '/teacher/reports', icon: <FiBarChart2 className={iconClass} /> },
  { label: 'Resources', href: '/teacher/resources', icon: <FiFolder className={iconClass} /> },
  { label: 'Story Generator', href: '/teacher/story-generator', icon: <FiFeather className={iconClass} /> },
  { label: 'Game Room', href: GAMEROOM_NAV_HREF, icon: <FiPlayCircle className={iconClass} /> },
  { label: 'Announcements', href: '/teacher/announcements', icon: <FiClipboard className={iconClass} /> },
  { label: 'Meetings', href: '/teacher/meetings', icon: <FiVideo className={iconClass} /> },
  { label: 'Chat', href: '/teacher/chat', icon: <FiMessageCircle className={iconClass} /> },
]

export const ADMIN_NAV_ITEMS: SidebarItem[] = [
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
