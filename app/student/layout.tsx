import { FiHome, FiBookOpen, FiFileText, FiAward, FiCheckSquare, FiSpeaker, FiUserCheck, FiMessageCircle, FiVideo, FiFolder, FiBarChart2, FiPlayCircle, FiUsers } from 'react-icons/fi'
import { auth } from '@clerk/nextjs/server'
import { RoleGuard, DashboardLayout, type SidebarItem } from '@/components/dashboard'
import { createClient } from '@/lib/supabase/server'

const iconClass = 'w-4 h-4 flex-shrink-0'

const baseNavItems: SidebarItem[] = [
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
  // A normal authenticated student route like every other item here --
  // students join with their real Clerk-backed identity now, not a
  // typed nickname, so scores/history can be aggregated across sessions
  // for the same actual person (see
  // supabase/migrations/057_game_room_student_identity.sql).
  // Opens the GameRoom mode selector (new GameRoom vs Classic). Classic
  // itself still lives at /student/game-room.
  // Temporary migration fallback. Remove Classic GameRoom only after
  // GameRoom V2 production stabilization.
  { label: 'Game Room', href: '/gameroom', icon: <FiPlayCircle className={iconClass} /> },
]

// Tamil Theni is the first nav item conditioned on something other than
// role -- shown only once the student has actually joined a season
// (join flow itself lives at /student/theni, reachable directly by URL
// even before enrolling, so a student without the sidebar item yet can
// still discover and use the join-code box there).
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  const supabase = createClient()

  const { data: student } = userId
    ? await supabase.from('sms_students').select('id').eq('profile_id', userId).maybeSingle()
    : { data: null }

  const { data: theniEnrollment } = student
    ? await supabase.from('sms_theni_enrollments').select('id').eq('student_id', student.id).limit(1).maybeSingle()
    : { data: null }

  const navItems: SidebarItem[] = theniEnrollment
    ? [...baseNavItems, { label: 'Tamil Theni', href: '/student/theni', icon: <span className="text-sm">🐝</span> }]
    : baseNavItems

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
