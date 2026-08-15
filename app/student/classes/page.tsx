import { FiClock, FiMapPin, FiUser } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import { JoinClassForm } from '@/components/classes/JoinClassForm'

export const dynamic = 'force-dynamic'

interface StudentClassRequest {
  id: string
  class_id: string
  class_name: string
  status: string
  requested_at: string
}

export default async function StudentClassesPage() {
  const supabase = createClient()

  // RLS ("classes: student read enrolled") already scopes this to only
  // classes this student is actively enrolled in.
  const [{ data: classes }, { data: pendingRequestsData }] = await Promise.all([
    supabase.from('sms_classes').select('*, teacher:sms_teachers!sms_classes_teacher_id_fkey(*, profile:sms_profiles(*))').order('name'),
    // Narrow RPC rather than an embedded sms_classes join -- a plain RLS
    // policy granting read access to a requested-but-not-yet-approved
    // class would leak into every OTHER unscoped sms_classes query in
    // the app too (see 025), including this very page's own query above.
    supabase.rpc('sms_my_student_class_requests'),
  ])
  const pendingRequests = (pendingRequestsData ?? []) as StudentClassRequest[]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">My Classes</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Classes you&apos;re enrolled in.</p>
      </div>

      <JoinClassForm endpoint="/api/student/class-requests" />

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
        <EmptyState title="Not enrolled in any class yet" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {classes.map((c) => (
            <div key={c.id} className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
              <h2 className="font-bold text-lg text-stone-800 dark:text-stone-100">{c.name}</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                {GRADE_LEVEL_OPTIONS.find((g) => g.value === c.grade_level)?.label || c.grade_level || 'No grade level set'}
              </p>
              <div className="space-y-1.5 mt-3 text-sm text-stone-600 dark:text-stone-300">
                <p className="flex items-center gap-2">
                  <FiUser className="w-4 h-4 flex-shrink-0" />
                  {c.teacher && c.teacher.profile.is_active
                    ? `${c.teacher.profile.first_name} ${c.teacher.profile.last_name}`
                    : 'Unassigned'}
                </p>
                {(c.schedule_day || c.start_time) && (
                  <p className="flex items-center gap-2">
                    <FiClock className="w-4 h-4 flex-shrink-0" />
                    {c.schedule_day} {c.start_time}
                    {c.end_time ? ` - ${c.end_time}` : ''}
                  </p>
                )}
                {c.room && (
                  <p className="flex items-center gap-2">
                    <FiMapPin className="w-4 h-4 flex-shrink-0" />
                    {c.room}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
