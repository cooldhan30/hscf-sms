import { createAdminClient } from '@/lib/supabase/admin'
import { AdminAssignmentsClient, type AdminAssignmentRow } from './AdminAssignmentsClient'

export const dynamic = 'force-dynamic'

// Every assignment school-wide, regardless of class/teacher. RLS
// ("assignments: admin all") already grants this to admin, but the
// service-role client is used for consistency with other admin list
// pages (e.g. admin/attendance).
export default async function AdminAssignmentsPage() {
  const admin = createAdminClient()

  const { data: assignments } = await admin
    .from('sms_assignments')
    .select('*, class:sms_classes(id, name), creator:sms_profiles(first_name, last_name)')
    .order('created_at', { ascending: false })
    .returns<AdminAssignmentRow[]>()

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Assignments</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Every assignment across every class -- sort by size to find what to clean up for storage space.
        </p>
      </div>

      <AdminAssignmentsClient initialAssignments={assignments ?? []} />
    </div>
  )
}
