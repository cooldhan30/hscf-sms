import { createAdminClient } from '@/lib/supabase/admin'
import { RegistrationsClient } from './RegistrationsClient'

// The admin client never touches cookies()/headers(), so Next.js has no
// signal that this fetch is request-specific -- force dynamic rendering
// so approvals/rejections are reflected immediately instead of serving a
// cached response.
export const dynamic = 'force-dynamic'

// Reads website_registrations directly with the service-role admin client:
// that table has no SELECT policy for the 'authenticated' role (by design,
// only privileged server code should read it), and this page only renders
// after RoleGuard has already confirmed the requester is an admin.
export default async function AdminRegistrationsPage() {
  const admin = createAdminClient()

  const { data: registrations } = await admin
    .from('website_registrations')
    .select('*')
    .order('registration_date', { ascending: false })

  // Which approved registrations still need a parent invited/linked --
  // drives the "Invite Parent" retry action (see invite-parent/route.ts).
  const { data: studentsFromRegistrations } = await admin
    .from('sms_students')
    .select('id, source_registration_id')
    .not('source_registration_id', 'is', null)

  const studentIds = (studentsFromRegistrations ?? []).map((s) => s.id)
  const { data: parentLinks } = studentIds.length
    ? await admin.from('sms_student_parents').select('student_id').in('student_id', studentIds)
    : { data: [] }

  const linkedStudentIds = new Set((parentLinks ?? []).map((l) => l.student_id))
  const registrationIdsNeedingParent = (studentsFromRegistrations ?? [])
    .filter((s) => !linkedStudentIds.has(s.id))
    .map((s) => s.source_registration_id as string)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Registrations</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Review and approve student registrations submitted on the website.
        </p>
      </div>

      <RegistrationsClient
        initialRegistrations={registrations ?? []}
        registrationIdsNeedingParent={registrationIdsNeedingParent}
      />
    </div>
  )
}
