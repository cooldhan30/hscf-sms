import Link from 'next/link'
import { FiUsers, FiClock } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import { JoinClassForm } from '@/components/classes/JoinClassForm'

export const dynamic = 'force-dynamic'

interface TeacherClassRequest {
  id: string
  class_id: string
  class_name: string
  status: string
  requested_at: string
}

export default async function TeacherClassesPage() {
  const supabase = createClient()

  // RLS ("classes: teacher read own") already scopes this to only the
  // signed-in teacher's own classes -- no explicit teacher_id filter needed.
  const [{ data: classes }, { data: pendingRequestsData }] = await Promise.all([
    supabase.from('sms_classes').select('*, enrollments:sms_class_enrollments(count)').order('name'),
    // Narrow RPC rather than an embedded sms_classes join -- a plain RLS
    // policy granting read access to a requested-but-not-yet-approved
    // class would leak into every OTHER unscoped sms_classes query in
    // the app too (see 025), including this very page's own query above.
    supabase.rpc('sms_my_teacher_class_requests'),
  ])
  const pendingRequests = (pendingRequestsData ?? []) as TeacherClassRequest[]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">My Classes</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Classes assigned to you.</p>
      </div>

      <JoinClassForm endpoint="/api/teacher/class-requests" />

      {pendingRequests && pendingRequests.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-stone-600 dark:text-stone-300">Your requests</h2>
          {pendingRequests.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900"
            >
              <span className="text-sm text-stone-700 dark:text-stone-200">{r.class_name}</span>
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

      {!classes || classes.length === 0 ? (
        <EmptyState title="No classes assigned yet" description="Once the admin assigns you a class, it'll show up here." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/teacher/classes/${c.id}`}
              className="block p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-primary-300 dark:hover:border-primary-800 transition-colors"
            >
              <h2 className="font-bold text-lg text-stone-800 dark:text-stone-100">{c.name}</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                {GRADE_LEVEL_OPTIONS.find((g) => g.value === c.grade_level)?.label || c.grade_level || 'No grade level set'}
              </p>
              <div className="flex items-center gap-4 mt-3 text-sm text-stone-500 dark:text-stone-400">
                {(c.schedule_day || c.start_time) && (
                  <span className="flex items-center gap-1.5">
                    <FiClock className="w-4 h-4" />
                    {c.schedule_day} {c.start_time}
                    {c.end_time ? ` - ${c.end_time}` : ''}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <FiUsers className="w-4 h-4" />
                  {c.enrollments?.[0]?.count ?? 0} students
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
