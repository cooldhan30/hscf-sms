import { createAdminClient } from '@/lib/supabase/admin'
import { AdminAttendanceClient } from './AdminAttendanceClient'

export const dynamic = 'force-dynamic'

// Cross-class attendance view: every class regardless of which teacher
// owns it, so admin can see what's been marked without opening each
// teacher's own attendance screen. Uses the admin client since sms_classes
// RLS otherwise scopes teachers to their own rows only.
export default async function AdminAttendancePage() {
  const admin = createAdminClient()

  const { data: rawClasses } = await admin
    .from('sms_classes')
    .select('id, name, grade_level, teacher:sms_teachers!sms_classes_teacher_id_fkey(profile:sms_profiles(first_name, last_name, is_active))')
    .order('name')
    .returns<
      {
        id: string
        name: string
        grade_level: string | null
        teacher: { profile: { first_name: string; last_name: string; is_active: boolean } | null } | null
      }[]
    >()

  // A disabled teacher's name shouldn't keep showing next to a class.
  const classes = (rawClasses ?? []).map((c) => ({
    ...c,
    teacher: c.teacher?.profile?.is_active ? c.teacher : null,
  }))

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
