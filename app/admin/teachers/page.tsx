import { createClient } from '@/lib/supabase/server'
import { TeachersClient } from './TeachersClient'

export const dynamic = 'force-dynamic'

export default async function AdminTeachersPage() {
  const supabase = createClient()

  const { data: teachers } = await supabase
    .from('sms_teachers')
    .select('*, profile:sms_profiles(*)')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Teachers</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Manage teacher accounts and profiles.
        </p>
      </div>

      <TeachersClient initialTeachers={teachers ?? []} />
    </div>
  )
}
