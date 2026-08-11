import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentAcademicYear } from '@/lib/academic-year'

// POST /api/admin/payments/[studentId]/remind -- send a fee reminder to
// this student's linked parents.
//
// IMPORTANT: no email is sent. No email provider is configured in this
// project (same as the email templates in 013), so claiming "reminder
// emailed" in the UI would be a lie an admin would act on -- they'd stop
// chasing a parent who never heard anything.
//
// What DOES happen: the reminder is recorded, and every linked parent
// gets an in-app notification, which is a channel that works today with
// no third party. When a provider is added, the send goes here, right
// beside this call, and the UI copy changes with it.
export async function POST(_request: Request, { params }: { params: { studentId: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()
  const academicYear = await currentAcademicYear(admin)

  const { data, error } = await admin.rpc('sms_send_payment_reminder', {
    p_student_id: params.studentId,
    p_academic_year: academicYear,
    p_actor_id: guard.profile.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    success: true,
    notified: data ?? 0,
    // The UI uses this to say what actually happened rather than
    // implying an email went out.
    emailSent: false,
  })
}
