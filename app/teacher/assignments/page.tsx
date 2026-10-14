import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { sortByDueDate } from '@/lib/dates'
import { auth } from '@clerk/nextjs/server'
import { AssignmentsClient } from './AssignmentsClient'
import { TeacherGamesSection } from '@/components/grClassic/portal/PortalGames'
import { portalTeacherGames } from '@/lib/grClassic/server/portal'
import { isGrClassicEnabled } from '@/lib/grClassic/release'

export const dynamic = 'force-dynamic'

export default async function TeacherAssignmentsPage() {
  const supabase = createClient()

  const { userId } = await auth()
  const [{ data: classes }, { data: assignments }, games] = await Promise.all([
    supabase.from('sms_classes').select('id, name').order('name'),
    supabase.from('sms_assignments').select('*, class:sms_classes(id, name)').order('created_at', { ascending: false }),
    // GameRoom Classic assignments (empty when switched off).
    portalTeacherGames(supabase, userId),
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
        <AssignmentsClient classes={classes ?? []} initialAssignments={sortByDueDate(assignments ?? [])} />
      </Suspense>

      {isGrClassicEnabled() && <TeacherGamesSection items={games} />}
    </div>
  )
}
