import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { GradesClient } from './GradesClient'

export const dynamic = 'force-dynamic'

export default async function StudentGradesPage() {
  const supabase = createClient()

  const { userId } = await auth()

  const { data: student } = await supabase.from('sms_students').select('id').eq('profile_id', userId ?? '').single()

  // RLS ("grades: student read own") already scopes this to the
  // signed-in student's own grade rows only.
  const { data: grades } = await supabase
    .from('sms_grades')
    .select('*, assignment:sms_assignments!inner(id, title, max_score, class:sms_classes!inner(id, name))')
    .eq('student_id', student?.id ?? '')
    .not('score', 'is', null)
    .order('graded_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">My Grades</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Scores and feedback from graded assignments.</p>
      </div>

      <GradesClient grades={grades ?? []} />
    </div>
  )
}
