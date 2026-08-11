import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkOrInviteParent } from '@/lib/admin-actions'

// POST /api/admin/registrations/[id]/invite-parent
//
// Retries the parent find-or-invite-and-link step for an already-approved
// registration whose student has no linked parent yet (see approve/route.ts
// for why this can fail and get left in that state). Looks the student up
// by source_registration_id rather than requiring the caller to know its
// id -- the admin UI only ever has the registration id.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const admin = createAdminClient()

  const { data: registration, error: findError } = await admin
    .from('website_registrations')
    .select('*')
    .eq('id', params.id)
    .single()

  if (findError || !registration) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
  }

  if (registration.registration_status !== 'approved') {
    return NextResponse.json({ error: 'Registration must be approved first' }, { status: 400 })
  }

  // .limit(1) rather than .single(): a handful of registrations approved
  // before the fix in approve/route.ts (which now marks approved
  // atomically with student creation) can have more than one sms_students
  // row for the same registration, from repeated failed-approval retries.
  // .single() throws on >1 rows, which is exactly the wrong failure mode
  // here -- pick the earliest one rather than erroring.
  const { data: students, error: studentError } = await admin
    .from('sms_students')
    .select('id')
    .eq('source_registration_id', registration.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const student = students?.[0]
  if (studentError || !student) {
    return NextResponse.json({ error: 'No student found for this registration' }, { status: 404 })
  }

  const result = await linkOrInviteParent({
    studentId: student.id,
    parentEmail: registration.parent_email,
    parentFirstName: registration.parent_first_name,
    parentLastName: registration.parent_last_name,
    parentPhone: registration.parent_phone,
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, parentTempPassword: result.parentTempPassword })
}
