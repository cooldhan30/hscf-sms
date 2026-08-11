import Link from 'next/link'
import { FiChevronRight } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import { LinkRequestForm } from './LinkRequestForm'
import type { SmsStudent } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function ParentChildrenPage() {
  const supabase = createClient()

  const { userId } = await auth()

  const { data: parent } = await supabase.from('sms_parents').select('id').eq('profile_id', userId ?? '').single()

  // RLS ("student_parents: parent read own links" + "students: parent read
  // own children") already scopes this to only this parent's linked kids.
  const [{ data: links }, { data: pendingRequests }] = await Promise.all([
    supabase
      .from('sms_student_parents')
      .select('relationship, student:sms_students(*)')
      .eq('parent_id', parent?.id ?? '')
      .returns<{ relationship: string | null; student: SmsStudent }[]>(),
    supabase
      .from('sms_parent_link_requests')
      .select('id, status, requested_at, student:sms_students(first_name, last_name)')
      .eq('parent_id', parent?.id ?? '')
      .in('status', ['pending', 'denied'])
      .returns<{ id: string; status: string; requested_at: string; student: { first_name: string; last_name: string } }[]>(),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">My Children</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">View each child&apos;s profile, class, and schedule.</p>
      </div>

      <LinkRequestForm />

      {pendingRequests && pendingRequests.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-stone-600 dark:text-stone-300">Your requests</h2>
          {pendingRequests.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900"
            >
              <span className="text-sm text-stone-700 dark:text-stone-200">
                {r.student.first_name} {r.student.last_name}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  r.status === 'pending'
                    ? 'bg-gold-100 text-gold-800 dark:bg-gold-950 dark:text-gold-300'
                    : 'bg-terracotta-100 text-terracotta-800 dark:bg-terracotta-950 dark:text-terracotta-300'
                }`}
              >
                {r.status === 'pending' ? 'Waiting for approval' : 'Denied'}
              </span>
            </div>
          ))}
        </div>
      )}

      {!links || links.length === 0 ? (
        <EmptyState title="No children linked yet" description="Send a request above, or contact the school office." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map((link, i) => (
            <Link
              key={i}
              href={`/parent/children/${link.student.id}`}
              className="flex items-center justify-between p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-primary-300 dark:hover:border-primary-800 transition-colors"
            >
              <div>
                <h2 className="font-bold text-stone-800 dark:text-stone-100">
                  {link.student.first_name} {link.student.last_name}
                </h2>
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                  {GRADE_LEVEL_OPTIONS.find((g) => g.value === link.student.grade_level)?.label ||
                    link.student.grade_level ||
                    'No grade level set'}
                </p>
              </div>
              <FiChevronRight className="w-5 h-5 text-stone-300 dark:text-stone-600 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
