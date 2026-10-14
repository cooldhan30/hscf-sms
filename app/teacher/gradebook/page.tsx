import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { GradebookClient } from './GradebookClient'
import { TeacherGamesSection } from '@/components/grClassic/portal/PortalGames'
import { portalTeacherGames } from '@/lib/grClassic/server/portal'
import { isGrClassicEnabled } from '@/lib/grClassic/release'

export const dynamic = 'force-dynamic'

export default async function TeacherGradebookPage() {
  const supabase = createClient()

  const { userId } = await auth()
  const [{ data: classes }, { data: assignments }, games] = await Promise.all([
    supabase.from('sms_classes').select('id, name').order('name'),
    supabase
      .from('sms_assignments')
      .select('id, class_id, title, max_score, due_date, points_deduction_per_day')
      .order('created_at', { ascending: false }),
    // GameRoom Classic assignments (empty when switched off).
    portalTeacherGames(supabase, userId),
  ])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Gradebook</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Enter and edit grades, with automatic percentage calculation.
        </p>
      </div>

      <Suspense fallback={null}>
        <GradebookClient classes={classes ?? []} assignments={assignments ?? []} />
      </Suspense>

      {isGrClassicEnabled() && <TeacherGamesSection items={games} />}
    </div>
  )
}
