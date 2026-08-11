import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkOrInviteParent } from '@/lib/admin-actions'

// POST /api/admin/registrations/[id]/approve
//
// Reads the pending row from website_registrations (marketing site's
// table -- untouched schema, only its pre-existing registration_status
// column is updated here, which is exactly what that column was designed
// for). Creates the sms_student and marks the registration approved
// immediately -- that's the part the admin actually needs to happen
// reliably (the student now exists, and can be given a class join code
// regardless of what happens next). Linking/inviting the parent account
// is attempted best-effort right after, but a failure there (a real
// network call to Clerk -- can fail on a duplicate email, transient
// error, etc.) no longer blocks approval or leaves the registration
// stuck in "pending": the response instead carries a non-fatal warning,
// and the same linking step can be retried from the "Invite Parent"
// action on the approved row (see invite-parent/route.ts). Previously
// this all happened in one all-or-nothing request, so a Clerk failure
// mid-flow left an orphaned sms_student with no way to finish approval
// short of re-running the whole thing. Fixed 2026-08-08.
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

  if (registration.registration_status === 'approved') {
    return NextResponse.json({ error: 'Registration is already approved' }, { status: 400 })
  }

  // 1. Create the student record (no login -- registrations don't collect
  // a student email; admin can invite one separately later if needed).
  const { data: student, error: studentError } = await admin
    .from('sms_students')
    .insert([
      {
        first_name: registration.student_first_name,
        last_name: registration.student_last_name,
        grade_level: registration.preferred_class_level,
        academic_year: registration.academic_year,
        source_registration_id: registration.id,
      },
    ])
    .select()
    .single()

  if (studentError) {
    return NextResponse.json({ error: `Failed to create student: ${studentError.message}` }, { status: 400 })
  }

  // 2. Mark the registration approved -- the student now exists, which is
  // the part that actually matters for the registration to be "done".
  const { error: statusError } = await admin
    .from('website_registrations')
    .update({ registration_status: 'approved' })
    .eq('id', registration.id)

  if (statusError) {
    return NextResponse.json(
      { error: `Student created, but updating registration status failed: ${statusError.message}` },
      { status: 400 }
    )
  }

  // 3. Best-effort: find-or-invite the parent account and link it. A
  // failure here is reported as a warning, not an error -- approval has
  // already succeeded, and this step is retryable from the UI.
  const parentResult = await linkOrInviteParent({
    studentId: student.id,
    parentEmail: registration.parent_email,
    parentFirstName: registration.parent_first_name,
    parentLastName: registration.parent_last_name,
    parentPhone: registration.parent_phone,
  })

  if ('error' in parentResult) {
    return NextResponse.json({
      success: true,
      studentId: student.id,
      parentTempPassword: null,
      warning: `Registration approved, but parent invite failed: ${parentResult.error}. Use "Invite Parent" to retry.`,
    })
  }

  return NextResponse.json({ success: true, studentId: student.id, parentTempPassword: parentResult.parentTempPassword })
}
