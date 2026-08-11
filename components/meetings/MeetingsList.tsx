import Link from 'next/link'
import { FiVideo } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/dashboard/EmptyState'

type ClassRow = { id: string; name: string; schedule_day: string | null; start_time: string | null; end_time: string | null }

// Works unchanged for all four portals: sms_classes RLS already returns
// exactly the classes this person belongs to -- every class for an admin,
// their own for a teacher, enrolled ones for a student, their children's
// for a parent. No role branching needed here.
export async function MeetingsList({ rolePrefix }: { rolePrefix: string }) {
  const supabase = createClient()

  const { data: classes } = await supabase
    .from('sms_classes')
    .select('id, name, schedule_day, start_time, end_time')
    .order('name')
    .returns<ClassRow[]>()

  if (!classes || classes.length === 0) {
    return (
      <EmptyState
        title="No class meetings"
        description="Meetings appear here for each class you belong to."
      />
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {classes.map((c) => (
        <li
          key={c.id}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="font-semibold text-stone-800 dark:text-stone-100 truncate">{c.name}</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {c.schedule_day || c.start_time
                ? `${c.schedule_day ?? ''} ${c.start_time ?? ''}${c.end_time ? ` - ${c.end_time}` : ''}`.trim()
                : 'No scheduled time'}
            </p>
          </div>
          <Link
            href={`${rolePrefix}/meetings/${c.id}`}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-primary-700 text-white hover:bg-primary-800 transition-colors"
          >
            <FiVideo className="w-4 h-4" />
            Join
          </Link>
        </li>
      ))}
    </ul>
  )
}
