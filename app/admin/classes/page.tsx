import { createClient } from '@/lib/supabase/server'
import { ClassesClient } from './ClassesClient'

export const dynamic = 'force-dynamic'

export default async function AdminClassesPage() {
  const supabase = createClient()

  const [{ data: classes }, { data: teachers }] = await Promise.all([
    supabase
      .from('sms_classes')
      .select('*, teacher:sms_teachers!sms_classes_teacher_id_fkey(*, profile:sms_profiles(*))')
      .order('created_at', { ascending: false }),
    supabase.from('sms_teachers').select('*, profile:sms_profiles(*)').order('created_at'),
  ])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Classes</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Create classes, assign teachers, and manage rosters.
        </p>
      </div>

      <ClassesClient initialClasses={classes ?? []} teachers={teachers ?? []} />
    </div>
  )
}
