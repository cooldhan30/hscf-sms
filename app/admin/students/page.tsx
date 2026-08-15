import { createClient } from '@/lib/supabase/server'
import { StudentsClient } from './StudentsClient'

export const dynamic = 'force-dynamic'

export default async function AdminStudentsPage() {
  const supabase = createClient()

  const { data: allStudents } = await supabase
    .from('sms_students')
    .select('*, profile:sms_profiles(*)')
    .order('created_at', { ascending: false })

  const students = (allStudents ?? []).filter((s) => !s.deleted_at)
  const deletedStudents = (allStudents ?? []).filter((s) => s.deleted_at)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Students</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Manage student profiles, logins, and parent links.
        </p>
      </div>

      <StudentsClient initialStudents={students} deletedStudents={deletedStudents} />
    </div>
  )
}
