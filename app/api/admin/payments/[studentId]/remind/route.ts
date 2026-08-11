import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentAcademicYear } from '@/lib/academic-year'
import { sendEmail, type EmailMessage } from '@/lib/email'

type ParentRow = { parent: { first_name: string; email: string | null } | null }

// POST /api/admin/payments/[studentId]/remind -- send a fee reminder to
// this student's linked parents.
//
// Three things happen, in order of how reliably they land:
//   1. the reminder is recorded (count + timestamp)
//   2. every linked parent gets an in-app notification
//   3. an email is attempted
//
// Step 3 depends on RESEND_API_KEY/RESEND_FROM being configured. When
// they are not -- which is the case today -- the route returns a
// prefilled mailto: link and the browser opens the admin's own email
// client, so the reminder still reaches the parent. Steps 1 and 2 happen
// either way, so a failed send never means nothing happened.
export async function POST(_request: Request, { params }: { params: { studentId: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()
  const academicYear = await currentAcademicYear(admin)

  const { data: notified, error } = await admin.rpc('sms_send_payment_reminder', {
    p_student_id: params.studentId,
    p_academic_year: academicYear,
    p_actor_id: guard.profile.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const [{ data: student }, { data: links }, { data: school }] = await Promise.all([
    admin.from('sms_students').select('first_name, last_name').eq('id', params.studentId).single(),
    admin
      .from('sms_student_parents')
      .select('parent:sms_parents(first_name, email)')
      .eq('student_id', params.studentId)
      .returns<ParentRow[]>(),
    admin.from('sms_school_settings').select('school_name, contact_email').eq('id', 1).maybeSingle(),
  ])

  const recipients = (links ?? [])
    .map((l) => l.parent?.email)
    .filter((e): e is string => Boolean(e))

  const studentName = student ? `${student.first_name} ${student.last_name}`.trim() : 'your child'
  const schoolName = school?.school_name ?? 'TSCF School'

  const message: EmailMessage = {
    to: recipients,
    subject: `Registration fee reminder - ${studentName}`,
    text:
      `Hello,\n\n` +
      `This is a reminder that the ${academicYear} registration fee for ${studentName} ` +
      `has not yet been recorded as paid.\n\n` +
      `If you have already paid, please let us know so we can update our records.\n\n` +
      `Thank you,\n${schoolName}` +
      (school?.contact_email ? `\n${school.contact_email}` : ''),
  }

  if (recipients.length === 0) {
    return NextResponse.json({
      notified: notified ?? 0,
      emailSent: false,
      reason: 'no-address',
    })
  }

  const result = await sendEmail(message)

  return NextResponse.json({
    notified: notified ?? 0,
    emailSent: result.sent,
    recipients,
    ...(result.sent
      ? {}
      : { reason: result.reason, emailError: result.error, mailto: result.mailto }),
  })
}
