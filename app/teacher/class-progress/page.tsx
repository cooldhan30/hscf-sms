import { createClient } from '@/lib/supabase/server'
import { ClassProgressClient } from '@/components/classProgress/ClassProgressClient'

export const dynamic = 'force-dynamic'

export default async function TeacherClassProgressPage() {
  const supabase = createClient()

  // RLS already scopes this to the classes this teacher teaches.
  const { data: classes } = await supabase.from('sms_classes').select('id, name').order('name')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Class Progress</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          See who in each class has submitted each assignment, and who still needs a reminder.
        </p>
      </div>

      <ClassProgressClient classes={classes ?? []} apiPath="/api/teacher/class-progress" />
    </div>
  )
}
