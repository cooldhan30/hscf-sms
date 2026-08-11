import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { LinkRequestActions } from './LinkRequestActions'

export const dynamic = 'force-dynamic'

export default async function StudentLinkRequestsPage() {
  const supabase = createClient()
  const { userId } = await auth()

  const { data: student } = await supabase.from('sms_students').select('id').eq('profile_id', userId ?? '').single()

  const { data: requests } = await supabase
    .from('sms_parent_link_requests')
    .select('id, requested_at, parent:sms_parents(first_name, last_name, email)')
    .eq('student_id', student?.id ?? '')
    .eq('status', 'pending')
    .returns<{ id: string; requested_at: string; parent: { first_name: string; last_name: string; email: string | null } }[]>()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Parent Link Requests</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Parents who want to be linked to your account so they can see your grades, attendance, and assignments.
        </p>
      </div>

      {!requests || requests.length === 0 ? (
        <EmptyState title="No pending requests" />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-bold text-stone-800 dark:text-stone-100">
                  {r.parent.first_name} {r.parent.last_name}
                </p>
                {r.parent.email && <p className="text-sm text-stone-500 dark:text-stone-400">{r.parent.email}</p>}
                <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">
                  Requested {new Date(r.requested_at).toLocaleDateString()}
                </p>
              </div>
              <LinkRequestActions requestId={r.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
