import { createAdminClient } from '@/lib/supabase/admin'
import { AdminAttendanceClient } from './AdminAttendanceClient'

export const dynamic = 'force-dynamic'

// Cross-class attendance view: every class regardless of which teacher
// owns it, so admin can see what's been marked without opening each
// teacher's own attendance screen. Uses the admin client since sms_classes
// RLS otherwise scopes teachers to their own rows only.
export default async function AdminAttendancePage() {
  const admin = createAdminClient()

  const { data: classes } = await admin
    .from('sms_classes')
    .select('id, name, grade_level, teacher:sms_teachers(profile:sms_profiles(first_name, last_name))')
    .order('name')
    .returns<
      { id: string; name: string; grade_level: string | null; teacher: { profile: { first_name: string; last_name: string } | null } | null }[]
    >()

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Attendance</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          View attendance marked by teachers across every class.
        </p>
      </div>

      <AdminAttendanceClient classes={classes ?? []} />
    </div>
  )
}
