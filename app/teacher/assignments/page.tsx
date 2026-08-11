import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AssignmentsClient } from './AssignmentsClient'

export const dynamic = 'force-dynamic'

export default async function TeacherAssignmentsPage() {
  const supabase = createClient()

  const [{ data: classes }, { data: assignments }] = await Promise.all([
    supabase.from('sms_classes').select('id, name').order('name'),
    supabase.from('sms_assignments').select('*, class:sms_classes(id, name)').order('created_at', { ascending: false }),
  ])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Assignments</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Create and manage assignments for your classes.
        </p>
      </div>

      <Suspense fallback={null}>
        <AssignmentsClient classes={classes ?? []} initialAssignments={assignments ?? []} />
      </Suspense>
    </div>
  )
}
