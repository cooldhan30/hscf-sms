import { auth } from '@clerk/nextjs/server'
import { RoleGuard, DashboardLayout, type SidebarItem } from '@/components/dashboard'
import { STUDENT_NAV_ITEMS, THENI_NAV_ITEM } from '@/components/dashboard/roleNav'
import { createClient } from '@/lib/supabase/server'

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
    ? [...STUDENT_NAV_ITEMS, THENI_NAV_ITEM]
    : STUDENT_NAV_ITEMS

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
